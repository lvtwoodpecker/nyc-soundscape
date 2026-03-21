"""
Gemini 2.5 Flash audio captioning for all SONYC clips.

Streams archives one at a time — extracts WAVs to a temp dir, captions each,
saves a checkpoint per archive. Fully resumable if interrupted.

Usage:
  source analysis/.venv/bin/activate
  export GEMINI_API_KEY=your_key_here
  python analysis/caption_clips.py --dry-run     # cost estimate + 5 sample captions
  python analysis/caption_clips.py --confirm     # full run (~$1, ~3-5h)

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
import time
import warnings
warnings.filterwarnings('ignore')

try:
    from google import genai
    from google.genai import types
except ImportError:
    print('error: google-genai not installed')
    print('  pip install google-genai')
    exit(1)

AUDIO_DIR      = 'audio'
META_PATH      = 'analysis/embeddings_meta.jsonl'
OUTPUT_PATH    = 'analysis/captions.jsonl'
CHECKPOINT_DIR = 'analysis/checkpoints'
MODEL_NAME     = 'gemini-2.5-flash'

# tune for your API tier — gemini-2.5-flash pay-as-you-go allows 1000 RPM
# using 60 to be conservative; I/O from archives is the real bottleneck anyway
REQUESTS_PER_MIN = 500

# hard spending limit — script saves checkpoint and exits cleanly when hit
MAX_COST_USD = 3.00

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
INPUT_PRICE_PER_M    = 0.15   # $ per 1M input tokens (gemini-2.5-flash approx)
OUTPUT_PRICE_PER_M   = 0.60   # $ per 1M output tokens


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


class BudgetExceeded(Exception):
    pass


class RateLimitHit(Exception):
    pass


def tokens_to_cost(input_tokens, output_tokens):
    return (input_tokens / 1e6) * INPUT_PRICE_PER_M + (output_tokens / 1e6) * OUTPUT_PRICE_PER_M


def caption_one(wav_path, client):
    """read WAV bytes, send inline to Gemini, return (caption, usage_metadata)"""
    audio_bytes = open(wav_path, 'rb').read()
    resp = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            PROMPT,
            types.Part.from_bytes(data=audio_bytes, mime_type='audio/wav'),
        ],
    )
    return resp.text.strip(), resp.usage_metadata


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
    n = len(meta)
    cost, input_tok, output_tok = estimate_cost(n)

    print('\n── cost estimate (projected) ──')
    print(f'  clips:         {n:,}')
    print(f'  input tokens:  ~{input_tok:,.0f}  (${(input_tok / 1e6) * INPUT_PRICE_PER_M:.2f})')
    print(f'  output tokens: ~{output_tok:,.0f}  (${(output_tok / 1e6) * OUTPUT_PRICE_PER_M:.2f})')
    print(f'  total (projected): ~${cost:.2f}')
    print(f'  note: audio token rate may differ — real count measured below')

    # pick 5 samples with variety
    labeled   = [m for m in meta if m.get('classes')]
    unlabeled = [m for m in meta if not m.get('classes')]
    samples   = []
    for target in ['engine', 'machinery', 'music', 'dog']:
        matches = [m for m in labeled if any(target in c for c in m.get('classes', []))]
        if matches:
            samples.append(random.choice(matches))
    if unlabeled:
        samples.append(random.choice(unlabeled))
    samples = samples[:5]

    print(f'\n── 5 sample captions ──')
    delay = 60.0 / REQUESTS_PER_MIN
    total_input_tokens  = 0
    total_output_tokens = 0
    n_measured = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, m in enumerate(samples):
            print(f'\n[{i + 1}/5]  {m["filename"]}  archive={m["archive"]}')
            print(f'        classes={m.get("classes", [])[:3]}  borough={m.get("borough")}  h={m.get("hour")}')
            wav_path = extract_one(m['archive'], m['filename'], tmpdir)
            if not wav_path:
                print('  could not extract from archive')
                continue
            try:
                t0 = time.time()
                caption, usage = caption_one(wav_path, client)
                elapsed = time.time() - t0
                print(f'  -> "{caption}"  ({elapsed:.1f}s)')
                if usage:
                    inp = getattr(usage, 'prompt_token_count', 0) or 0
                    out = getattr(usage, 'candidates_token_count', 0) or 0
                    print(f'     tokens: {inp} in / {out} out')
                    total_input_tokens  += inp
                    total_output_tokens += out
                    n_measured += 1
            except Exception as e:
                print(f'  error: {e}')
            if i < len(samples) - 1:
                time.sleep(delay)

    print('\n── real cost projection (from measured token counts) ──')
    if n_measured > 0:
        avg_in  = total_input_tokens  / n_measured
        avg_out = total_output_tokens / n_measured
        real_cost = (avg_in * n / 1e6) * INPUT_PRICE_PER_M + \
                    (avg_out * n / 1e6) * OUTPUT_PRICE_PER_M
        print(f'  avg tokens/clip: {avg_in:.0f} in / {avg_out:.0f} out  (from {n_measured} real clips)')
        print(f'  projected total for {n:,} clips: ~${real_cost:.2f}')
        est_hours = n / REQUESTS_PER_MIN / 60
        print(f'  time @ {REQUESTS_PER_MIN} RPM: ~{est_hours:.1f} hours')
    else:
        print(f'  all samples failed — fix errors above before running full batch')
        return

    print()
    print('set a Cloud budget alert before running full batch:')
    print('  console.cloud.google.com -> Billing -> Budgets & alerts')
    print()
    print('to run full batch:')
    print('  python analysis/caption_clips.py --confirm')


def process_archive(archive_num, archive_meta, client, spend):
    checkpoint = os.path.join(CHECKPOINT_DIR, f'captions_archive_{archive_num}.jsonl')
    print(f'\n── archive {archive_num} ({len(archive_meta)} clips) ──')
    results = []
    delay   = 60.0 / REQUESTS_PER_MIN

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

        print(f'  {len(path_map)} WAVs extracted, captioning at {REQUESTS_PER_MIN} RPM...')

        for i, m in enumerate(archive_meta):
            wav_path = path_map.get(m['filename'])
            if not wav_path:
                continue
            t0 = time.time()
            try:
                caption, usage = caption_one(wav_path, client)
                results.append({**m, 'caption': caption})
                # track spend and bail out if we hit the budget
                if usage:
                    inp = getattr(usage, 'prompt_token_count', 0) or 0
                    out = getattr(usage, 'candidates_token_count', 0) or 0
                    spend['input']  += inp
                    spend['output'] += out
                    current = tokens_to_cost(spend['input'], spend['output'])
                    if current >= MAX_COST_USD:
                        print(f'\n  budget limit ${MAX_COST_USD:.2f} reached (spent ~${current:.2f}) — stopping cleanly')
                        raise BudgetExceeded()
            except BudgetExceeded:
                # save whatever we have so far before propagating
                with open(checkpoint, 'w') as f:
                    for r in results:
                        f.write(json.dumps(r) + '\n')
                raise
            except Exception as e:
                # 429 = daily quota hit — stop cleanly, don't mark remaining as failed
                if '429' in str(e) or 'quota' in str(e).lower():
                    print(f'\n  API rate limit hit (daily quota) — stopping cleanly')
                    print(f'  resume tomorrow with: python analysis/caption_clips.py --confirm')
                    raise RateLimitHit()
                print(f'  error {m["filename"]}: {e}')
                results.append({**m, 'caption': None, 'error': str(e)})

            elapsed = time.time() - t0
            wait = max(0, delay - elapsed)
            if wait:
                time.sleep(wait)

            if (i + 1) % 100 == 0:
                current = tokens_to_cost(spend['input'], spend['output'])
                print(f'  {i + 1}/{len(archive_meta)} done  (~${current:.2f} spent so far)')

    with open(checkpoint, 'w') as f:
        for r in results:
            f.write(json.dumps(r) + '\n')

    succeeded = sum(1 for r in results if r.get('caption'))
    print(f'  checkpoint saved: {succeeded}/{len(results)} captioned')


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
    args = parser.parse_args()

    if not args.dry_run and not args.confirm:
        print('usage:')
        print('  python analysis/caption_clips.py --dry-run    # preview + 5 samples')
        print('  python analysis/caption_clips.py --confirm    # full run')
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

    # full run
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    by_archive = {}
    for m in meta:
        by_archive.setdefault(m['archive'], []).append(m)

    archives = sorted(by_archive.keys())
    done = already_done()
    if done:
        print(f'skipping already-done archives: {sorted(done)}')

    spend = {'input': 0, 'output': 0}
    print(f'spending limit: ${MAX_COST_USD:.2f} (edit MAX_COST_USD in script to change)')

    try:
        for n in archives:
            if n in done:
                continue
            process_archive(n, by_archive[n], client, spend)
    except BudgetExceeded:
        print(f'\nstopped at ${MAX_COST_USD:.2f} budget limit — run again to resume from here')
    except RateLimitHit:
        print(f'\nstopped at daily quota limit (10K RPD) — run again tomorrow to resume')

    merge_checkpoints()
    total_spent = tokens_to_cost(spend['input'], spend['output'])
    print(f'\ntotal spent this run: ~${total_spent:.2f}')
    print('done.')


if __name__ == '__main__':
    main()
