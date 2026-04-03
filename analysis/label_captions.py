"""
Label each gt clip's caption with Ollama to assess how prominently
each annotated sound class appears in the recording.

Reads:  analysis/outputs/captions.jsonl
Writes: analysis/outputs/labeled_captions.jsonl  (appends — safe to resume)

Each output entry adds:
  "labels": {
    "<fine_class>": { "dominant": bool, "prominence": str, "confidence": float }
  }

Usage:
  python analysis/label_captions.py
  python analysis/label_captions.py --dry-run   # show first 5, no writes
"""

import argparse
import json
import re
import time
import urllib.request
from pathlib import Path

CAPTIONS_PATH = Path('analysis/outputs/captions.jsonl')
OUTPUT_PATH   = Path('analysis/outputs/labeled_captions.jsonl')
MODEL         = 'qwen3.5:2b'
OLLAMA_URL    = 'http://localhost:11434/api/generate'

# short, direct prompt — qwen3.5:2b handles this reliably
PROMPT = '''\
Audio recording description:
"{caption}"

Sound class: {cls}

Is "{cls}" a dominant foreground sound in this recording, or is it in the background / barely present?

Reply with JSON only:
{{"dominant": true or false, "prominence": "dominant" or "background" or "faint", "confidence": 0.0 to 1.0}}'''


def call_ollama(prompt, retries=2):
    # /no_think disables qwen3's thinking mode — faster and avoids JSON parse failures
    payload = json.dumps({
        'model': MODEL,
        'prompt': prompt + '\n/no_think',
        'stream': False,
        'format': 'json',
    }).encode()
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                OLLAMA_URL, data=payload,
                headers={'Content-Type': 'application/json'},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = json.loads(r.read())
                response = raw['response'].strip()
                # strip any residual <think>...</think> blocks just in case
                response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL).strip()
                return json.loads(response)
        except Exception:
            if attempt < retries:
                time.sleep(2)
    return None


def label_entry(entry):
    labels = {}
    for cls in entry.get('classes', []):
        prompt = PROMPT.format(caption=entry['caption'], cls=cls)
        result = call_ollama(prompt)
        if result:
            # normalize prominence in case model uses slightly different wording
            prominence = result.get('prominence', 'unknown').lower()
            if 'dominant' in prominence or 'foreground' in prominence or 'primary' in prominence:
                prominence = 'dominant'
            elif 'faint' in prominence or 'barely' in prominence or 'subtle' in prominence:
                prominence = 'faint'
            elif 'background' in prominence:
                prominence = 'background'
            labels[cls] = {
                'dominant':   bool(result.get('dominant', False)),
                'prominence': prominence,
                'confidence': float(result.get('confidence', 0.5)),
            }
        else:
            labels[cls] = {'dominant': False, 'prominence': 'unknown', 'confidence': 0.0}
    return labels


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    entries = []
    with open(CAPTIONS_PATH) as f:
        for line in f:
            e = json.loads(line.strip())
            if e.get('gt') and e.get('classes'):
                entries.append(e)

    print(f'{len(entries)} gt clips with class labels')

    done = set()
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH) as f:
            for line in f:
                done.add(json.loads(line.strip())['filename'])
        print(f'{len(done)} already processed, skipping')

    remaining = [e for e in entries if e['filename'] not in done]
    total = len(remaining)

    if args.dry_run:
        print(f'\n{total} would be processed. sample (first 5):\n')
        for e in remaining[:5]:
            print(f'  {e["filename"]}  classes: {e["classes"]}')
            print(f'  caption: {e["caption"][:120]}...\n')
        return

    print(f'{total} to process\n')

    recent_times = []

    with open(OUTPUT_PATH, 'a') as out:
        for i, entry in enumerate(remaining):
            t0 = time.time()
            labels = label_entry(entry)
            elapsed = time.time() - t0
            recent_times.append(elapsed)

            out.write(json.dumps({**entry, 'labels': labels}) + '\n')
            out.flush()

            pct = (i + 1) / total * 100
            label_str = '  '.join(
                f'{c}: {labels[c]["prominence"]} ({labels[c]["confidence"]:.2f})'
                for c in labels
            )
            print(f'[{pct:5.1f}%] {i+1}/{total}  {entry["filename"]}  ({elapsed:.1f}s)')
            print(f'         {label_str}')

            if len(recent_times) % 20 == 0:
                avg = sum(recent_times[-20:]) / 20
                eta_min = (total - i - 1) * avg / 60
                print(f'  avg {avg:.1f}s/clip — eta ~{eta_min:.0f} min remaining\n')

    print(f'\ndone → {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
