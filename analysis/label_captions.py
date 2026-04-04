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

# human-readable labels for the SONYC fine class names used in the prompt
CLASS_LABELS = {
    'small-sounding-engine':          'small engine (scooter, motorcycle, small car)',
    'medium-sounding-engine':         'medium engine (car, sedan)',
    'large-sounding-engine':          'large engine (bus, truck, heavy vehicle)',
    'rock-drill':                     'rock drill or boring machine',
    'jackhammer':                     'jackhammer or pneumatic hammer',
    'hoe-ram':                        'hoe-ram or hydraulic demolition hammer',
    'pile-driver':                    'pile driver',
    'non-machinery-impact':           'non-machinery impact (bang, clang, thud, crash)',
    'chainsaw':                       'chainsaw or power saw',
    'small-medium-rotating-saw':      'rotating saw or angle grinder (metallic grinding/whirring)',
    'large-rotating-saw':             'large industrial rotating saw',
    'car-horn':                       'car horn or honking',
    'car-alarm':                      'car alarm',
    'siren':                          'emergency siren (ambulance, police, fire truck)',
    'reverse-beeper':                 'reverse beeper (backing-up alarm beeps)',
    'stationary-music':               'music playing from a fixed source (busker, speaker, venue)',
    'mobile-music':                   'music from a moving source (car stereo, passing vehicle)',
    'ice-cream-truck':                'ice cream truck jingle or chime',
    'person-or-small-group-talking':  'person or small group talking or conversing',
    'person-or-small-group-shouting': 'person or small group shouting or yelling',
    'large-crowd':                    'large crowd noise or cheering',
    'amplified-speech':               'amplified speech (megaphone, PA system, loudspeaker)',
    'dog-barking-whining':            'dog barking or whining',
}

PROMPT = '''\
Audio recording description:
"{caption}"

Question: Does this description explicitly mention or clearly describe "{label}"?
If the description is about a clearly different sound, answer not_present.

JSON only, no explanation:
{{"present": true or false, "prominence": "dominant" or "background" or "faint" or "not_present", "confidence": 0.0 to 1.0}}'''


def call_ollama(prompt, retries=2):
    # think:false disables qwen3's chain-of-thought — ~1s/call instead of 20s+
    payload = json.dumps({
        'model': MODEL,
        'prompt': prompt,
        'stream': False,
        'think': False,
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
        label = CLASS_LABELS.get(cls, cls)
        prompt = PROMPT.format(caption=entry['caption'], label=label)
        result = call_ollama(prompt)
        if result:
            prominence = result.get('prominence', 'not_present').lower()
            if 'dominant' in prominence or 'foreground' in prominence or 'primary' in prominence:
                prominence = 'dominant'
            elif 'faint' in prominence or 'barely' in prominence or 'subtle' in prominence:
                prominence = 'faint'
            elif 'background' in prominence:
                prominence = 'background'
            else:
                prominence = 'not_present'
            present = bool(result.get('present', False)) and prominence != 'not_present'
            labels[cls] = {
                'dominant':   present and prominence == 'dominant',
                'present':    present,
                'prominence': prominence,
                'confidence': float(result.get('confidence', 0.5)),
            }
        else:
            labels[cls] = {'dominant': False, 'present': False, 'prominence': 'unknown', 'confidence': 0.0}
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
