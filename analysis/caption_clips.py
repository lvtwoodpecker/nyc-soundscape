"""
Gemini audio captioning for all SONYC clips.

Streams archives one at a time — extracts WAVs to a temp dir, captions with
concurrent workers, saves a checkpoint per archive. Resumable if interrupted.

Usage:
  source analysis/.venv/bin/activate
  export GEMINI_API_KEY=your_key_here
  python analysis/caption_clips.py --dry-run     # cost estimate + 100 sample captions
  python analysis/caption_clips.py --confirm     # full run (remaining archives only)

Output:
  analysis/captions.jsonl — one JSON line per clip:
    { filename, archive, borough, hour, classes, caption }
"""

import argparse
import json
import os
import random
import tarfile
import tempfile
import threading
import time
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
warnings.filterwarnings('ignore')

try:
    from google import genai
    from google.genai import types
except ImportError:
    print('error: google-genai not installed')
    print('  pip install google-genai')
    exit(1)

AUDIO_DIR      = 'audio'
META_PATH      = 'analysis/outputs/embeddings_meta.jsonl'
OUTPUT_PATH    = 'analysis/outputs/captions.jsonl'
CHECKPOINT_DIR = 'analysis/checkpoints'
MODEL_NAME     = 'gemini-2.5-flash-lite'

# 60 concurrent workers × ~6s latency = ~600 RPM (under the 4000 RPM flash-lite limit)
MAX_WORKERS = 60

# hard spending limit — script saves checkpoint and exits cleanly when hit
MAX_COST_USD = 5.00

# AI usage disclosure (contest requirement): Gemini 2.5 Flash-Lite prompt used to
# generate natural-language descriptions of 18,510 SONYC audio clips.
PROMPT = (
    'Describe this 10-second urban sound recording in 2-3 sentences. '
    'Be specific: what sounds are present, how prominent are they, '
    'and what does the acoustic environment feel like? '
    'Mention rhythm, distance, texture, or mood if relevant.'
)

# token estimates for cost projection (before real measurements)
AUDIO_TOKENS_PER_SEC = 32
CLIP_SECS            = 10
PROMPT_TOKENS        = 60
RESPONSE_TOKENS      = 100
# gemini-2.5-flash-lite: audio input $0.30/M, text output $0.40/M (no thinking mode)
INPUT_PRICE_PER_M    = 0.30   # using audio rate for all input (audio dominates, slight overestimate)
OUTPUT_PRICE_PER_M   = 0.40


def load_meta():
    meta = []
    with open(META_PATH) as f:
        for line in f:
            meta.append(json.loads(line))
    return meta


def estimate_cost(n_clips):
    input_tokens  = n_clips * (AUDIO_TOKENS_PER_SEC * CLIP_SECS + PROMPT_TOKENS)
    output_tokens = n_clips * RESPONSE_TOKENS
    cost = (input_tokens / 1e6) * INPUT_PRICE_PER_M + (output_tokens / 1e6) * OUTPUT_PRICE_PER_M
    return cost, input_tokens, output_tokens


def tokens_to_cost(input_tokens, output_tokens):
    return (input_tokens / 1e6) * INPUT_PRICE_PER_M + (output_tokens / 1e6) * OUTPUT_PRICE_PER_M


def caption_one(wav_path, client):
    """send WAV bytes inline to Gemini, return (caption, usage_metadata)"""
    audio_bytes = open(wav_path, 'rb').read()
    for attempt in range(4):
        try:
            resp = client.models.generate_content(
                model=MODEL_NAME,
                contents=[
                    PROMPT,
                    types.Part.from_bytes(data=audio_bytes, mime_type='audio/wav'),
                ],
            )
            return resp.text.strip(), resp.usage_metadata
        except Exception as e:
            msg = str(e)
            # retry on transient server errors, not on quota/auth errors
            if attempt < 3 and ('503' in msg or '500' in msg):
                time.sleep(2 ** attempt)  # 1s, 2s, 4s
                continue
            raise


def extract_one(archive_num, filename, tmpdir):
    """extract a single WAV from an archive, return its path"""
    archive_path = os.path.join(AUDIO_DIR, f'audio-{archive_num}.tar.gz')
    with tarfile.open(archive_path, 'r:gz') as tf:
        for member in tf.getmembers():
            if os.path.basename(member.name) == filename:
                tf.extract(member, tmpdir)
                return os.path.join(tmpdir, member.name)
    return None


def already_done():
    done = set()
    if os.path.isdir(CHECKPOINT_DIR):
        for f in os.listdir(CHECKPOINT_DIR):
            if f.startswith('captions_archive_') and f.endswith('.jsonl'):
                try:
                    n = int(f.replace('captions_archive_', '').replace('.jsonl', ''))
                    done.add(n)
                except ValueError:
                    pass
    return done


def run_dry_run(meta, client):
    done = already_done()
    by_archive = {}
    for m in meta:
        by_archive.setdefault(m['archive'], []).append(m)

    remaining_archives = sorted(n for n in by_archive if n not in done)
    remaining_clips    = sum(len(by_archive[n]) for n in remaining_archives)

    print(f'\n── progress ──')
    print(f'  done archives:      {sorted(done)}  ({len(done) * 1000:,} clips)')
    print(f'  remaining archives: {remaining_archives}  ({remaining_clips:,} clips)')

    if not remaining_archives:
        print('  all archives done — nothing to run')
        return

    # pull 100 clips from the first remaining archive for a real cost measurement
    first_archive = remaining_archives[0]
    pool = by_archive[first_archive]
    samples = random.sample(pool, min(100, len(pool)))

    print(f'\n── dry run: 100 clips from archive {first_archive} with {MAX_WORKERS} workers ──')
    total_input_tokens  = 0
    total_output_tokens = 0
    n_ok  = 0
    n_err = 0
    lock  = threading.Lock()
    t0    = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = os.path.join(AUDIO_DIR, f'audio-{first_archive}.tar.gz')
        print(f'  extracting {archive_path}...')
        with tarfile.open(archive_path, 'r:gz') as tf:
            sample_names = {m['filename'] for m in samples}
            targets = [mb for mb in tf.getmembers() if os.path.basename(mb.name) in sample_names]
            tf.extractall(tmpdir, members=targets)

        path_map = {}
        for root, _, files in os.walk(tmpdir):
            for f in files:
                if f.endswith('.wav'):
                    path_map[f] = os.path.join(root, f)

        def process_one(m):
            wav_path = path_map.get(m['filename'])
            if not wav_path:
                return None, None, 'missing'
            try:
                caption, usage = caption_one(wav_path, client)
                return caption, usage, None
            except Exception as e:
                return None, None, str(e)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_one, m): m for m in samples}
            for future in as_completed(futures):
                caption, usage, error = future.result()
                with lock:
                    if error:
                        n_err += 1
                        if n_err <= 3:
                            print(f'  error: {error}')
                    else:
                        n_ok += 1
                        if usage:
                            total_input_tokens  += getattr(usage, 'prompt_token_count', 0) or 0
                            total_output_tokens += getattr(usage, 'candidates_token_count', 0) or 0

    elapsed = time.time() - t0
    print(f'  done: {n_ok} ok, {n_err} errors, {elapsed:.0f}s elapsed')

    print('\n── real cost projection ──')
    if n_ok > 0:
        avg_in  = total_input_tokens  / n_ok
        avg_out = total_output_tokens / n_ok
        cost_100     = tokens_to_cost(total_input_tokens, total_output_tokens)
        cost_remain  = (avg_in * remaining_clips / 1e6) * INPUT_PRICE_PER_M + \
                       (avg_out * remaining_clips / 1e6) * OUTPUT_PRICE_PER_M
        throughput = MAX_WORKERS / (elapsed / n_ok)
        est_min = remaining_clips / throughput / 60
        print(f'  model:            {MODEL_NAME}')
        print(f'  avg tokens/clip:  {avg_in:.0f} in / {avg_out:.0f} out  (from {n_ok} clips)')
        print(f'  cost for 100:     ${cost_100:.4f}')
        print(f'  projected for {remaining_clips:,} remaining clips: ~${cost_remain:.2f}')
        print(f'  time estimate:    ~{est_min:.0f} min with {MAX_WORKERS} workers')
        print(f'  spending limit:   ${MAX_COST_USD:.2f}')
    else:
        print('  all samples failed — fix errors above before running full batch')
        return

    print()
    print('to run full batch (skips already-done archives):')
    print('  python analysis/caption_clips.py --confirm')


def process_archive(archive_num, archive_meta, client, spend, stop_event):
    checkpoint = os.path.join(CHECKPOINT_DIR, f'captions_archive_{archive_num}.jsonl')
    print(f'\n── archive {archive_num} ({len(archive_meta)} clips) ──')
    results = []
    lock = threading.Lock()

    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = os.path.join(AUDIO_DIR, f'audio-{archive_num}.tar.gz')
        print(f'  extracting {archive_path}...')
        with tarfile.open(archive_path, 'r:gz') as tf:
            wav_members = [m for m in tf.getmembers() if m.name.endswith('.wav')]
            tf.extractall(tmpdir, members=wav_members)

        path_map = {}
        for root, _, files in os.walk(tmpdir):
            for f in files:
                if f.endswith('.wav'):
                    path_map[f] = os.path.join(root, f)

        print(f'  {len(path_map)} WAVs extracted, captioning with {MAX_WORKERS} workers...')

        def process_one(m):
            if stop_event.is_set():
                return m, None, None, 'stopped'
            wav_path = path_map.get(m['filename'])
            if not wav_path:
                return m, None, None, 'missing'
            try:
                caption, usage = caption_one(wav_path, client)
                return m, caption, usage, None
            except Exception as e:
                return m, None, None, str(e)

        done_count = 0
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_one, m): m for m in archive_meta}
            for future in as_completed(futures):
                m, caption, usage, error = future.result()

                with lock:
                    if error == 'stopped':
                        continue
                    elif error == 'missing':
                        continue
                    elif error and ('429' in error or 'quota' in error.lower()):
                        print(f'\n  API daily quota hit — stopping cleanly')
                        print(f'  resume tomorrow: python analysis/caption_clips.py --confirm')
                        stop_event.set()
                    elif error:
                        print(f'  error {m["filename"]}: {error}')
                        results.append({**m, 'caption': None, 'error': error})
                    else:
                        results.append({**m, 'caption': caption})
                        if usage:
                            inp = getattr(usage, 'prompt_token_count', 0) or 0
                            out = getattr(usage, 'candidates_token_count', 0) or 0
                            spend['input']  += inp
                            spend['output'] += out
                            current = tokens_to_cost(spend['input'], spend['output'])
                            if current >= MAX_COST_USD:
                                print(f'\n  budget limit ${MAX_COST_USD:.2f} reached (~${current:.2f}) — stopping')
                                stop_event.set()

                    done_count += 1
                    if done_count % 100 == 0:
                        current = tokens_to_cost(spend['input'], spend['output'])
                        print(f'  {done_count}/{len(archive_meta)} done  (~${current:.3f} spent)')

    with open(checkpoint, 'w') as f:
        for r in results:
            f.write(json.dumps(r) + '\n')

    succeeded = sum(1 for r in results if r.get('caption'))
    print(f'  checkpoint saved: {succeeded}/{len(results)} captioned')


def retry_errors(client, spend, stop_event):
    """re-caption any clips that previously failed (caption is None)"""
    checkpoints = sorted(
        f for f in os.listdir(CHECKPOINT_DIR)
        if f.startswith('captions_archive_') and f.endswith('.jsonl')
    )
    if not checkpoints:
        print('no checkpoints found')
        return

    total_errors = 0
    for fname in checkpoints:
        path = os.path.join(CHECKPOINT_DIR, fname)
        rows = []
        with open(path) as f:
            for line in f:
                rows.append(json.loads(line))
        errors = [r for r in rows if not r.get('caption')]
        total_errors += len(errors)

    print(f'found {total_errors} failed clips across {len(checkpoints)} archives')
    if total_errors == 0:
        print('nothing to retry')
        return

    for fname in checkpoints:
        if stop_event.is_set():
            break
        path = os.path.join(CHECKPOINT_DIR, fname)
        rows = []
        with open(path) as f:
            for line in f:
                rows.append(json.loads(line))

        to_retry = {r['filename']: r for r in rows if not r.get('caption')}
        if not to_retry:
            continue

        archive_num = int(fname.replace('captions_archive_', '').replace('.jsonl', ''))
        print(f'\n── archive {archive_num}: retrying {len(to_retry)} failed clips ──')

        with tempfile.TemporaryDirectory() as tmpdir:
            archive_path = os.path.join(AUDIO_DIR, f'audio-{archive_num}.tar.gz')
            with tarfile.open(archive_path, 'r:gz') as tf:
                targets = [m for m in tf.getmembers() if os.path.basename(m.name) in to_retry]
                tf.extractall(tmpdir, members=targets)

            path_map = {}
            for root, _, files in os.walk(tmpdir):
                for f in files:
                    if f.endswith('.wav'):
                        path_map[f] = os.path.join(root, f)

            lock = threading.Lock()
            results_map = {}

            def process_one(m):
                if stop_event.is_set():
                    return m, None, None, 'stopped'
                wav_path = path_map.get(m['filename'])
                if not wav_path:
                    return m, None, None, 'missing'
                try:
                    caption, usage = caption_one(wav_path, client)
                    return m, caption, usage, None
                except Exception as e:
                    return m, None, None, str(e)

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(process_one, m): m for m in to_retry.values()}
                for future in as_completed(futures):
                    m, caption, usage, error = future.result()
                    with lock:
                        if error == 'stopped':
                            continue
                        elif error and ('429' in error or 'quota' in error.lower()):
                            print(f'\n  API daily quota hit — stopping cleanly')
                            stop_event.set()
                        elif error:
                            print(f'  still failing {m["filename"]}: {error}')
                            results_map[m['filename']] = {**m, 'caption': None, 'error': error}
                        else:
                            results_map[m['filename']] = {**m, 'caption': caption}
                            if usage:
                                inp = getattr(usage, 'prompt_token_count', 0) or 0
                                out = getattr(usage, 'candidates_token_count', 0) or 0
                                spend['input'] += inp
                                spend['output'] += out
                                current = tokens_to_cost(spend['input'], spend['output'])
                                if current >= MAX_COST_USD:
                                    print(f'\n  budget limit ${MAX_COST_USD:.2f} reached — stopping')
                                    stop_event.set()

        # update checkpoint: replace failed rows with new results
        updated = []
        for r in rows:
            updated.append(results_map.get(r['filename'], r))

        with open(path, 'w') as f:
            for r in updated:
                f.write(json.dumps(r) + '\n')

        fixed = sum(1 for r in updated if r.get('caption') and r['filename'] in to_retry)
        print(f'  fixed {fixed}/{len(to_retry)} in archive {archive_num}')


def merge_checkpoints():
    print('\nmerging checkpoints...')
    archives = sorted(
        int(f.replace('captions_archive_', '').replace('.jsonl', ''))
        for f in os.listdir(CHECKPOINT_DIR)
        if f.startswith('captions_archive_') and f.endswith('.jsonl')
    )
    total = 0
    with open(OUTPUT_PATH, 'w') as out:
        for n in archives:
            path = os.path.join(CHECKPOINT_DIR, f'captions_archive_{n}.jsonl')
            with open(path) as f:
                lines = f.readlines()
                out.writelines(lines)
                total += len(lines)
    print(f'merged {len(archives)} archives, {total} clips -> {OUTPUT_PATH}')


def main():
    parser = argparse.ArgumentParser(description='Gemini audio captioning for SONYC clips')
    parser.add_argument('--dry-run', action='store_true',
                        help='print cost estimate and run 5 sample captions only')
    parser.add_argument('--confirm', action='store_true',
                        help='run the full batch')
    parser.add_argument('--retry-errors', action='store_true',
                        help='re-caption any clips that failed (caption is None) in existing checkpoints')
    args = parser.parse_args()

    if not args.dry_run and not args.confirm and not args.retry_errors:
        print('usage:')
        print('  python analysis/caption_clips.py --dry-run       # preview + 5 samples')
        print('  python analysis/caption_clips.py --confirm       # full run (~$2, ~30 min)')
        print('  python analysis/caption_clips.py --retry-errors  # re-run failed clips')
        return

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print('error: GEMINI_API_KEY not set')
        print('  export GEMINI_API_KEY=your_key_here')
        return

    client = genai.Client(api_key=api_key)
    meta   = load_meta()
    print(f'loaded {len(meta)} clips from {META_PATH}')

    if args.dry_run:
        run_dry_run(meta, client)
        return

    # retry errors mode
    if args.retry_errors:
        os.makedirs(CHECKPOINT_DIR, exist_ok=True)
        spend = {'input': 0, 'output': 0}
        stop_event = threading.Event()
        retry_errors(client, spend, stop_event)
        merge_checkpoints()
        print(f'\ntotal spent this retry run: ~${tokens_to_cost(spend["input"], spend["output"]):.2f}')
        print('done.')
        return

    # full run
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    by_archive = {}
    for m in meta:
        by_archive.setdefault(m['archive'], []).append(m)

    archives   = sorted(by_archive.keys())
    done       = already_done()
    spend      = {'input': 0, 'output': 0}
    stop_event = threading.Event()

    if done:
        print(f'skipping already-done archives: {sorted(done)}')
    print(f'spending limit: ${MAX_COST_USD:.2f}  |  workers: {MAX_WORKERS}')

    for n in archives:
        if n in done:
            continue
        process_archive(n, by_archive[n], client, spend, stop_event)
        if stop_event.is_set():
            break

    merge_checkpoints()
    total_spent = tokens_to_cost(spend['input'], spend['output'])
    print(f'\ntotal spent this run: ~${total_spent:.2f}')
    print('done.')


if __name__ == '__main__':
    main()
