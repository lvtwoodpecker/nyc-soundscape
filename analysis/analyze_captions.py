"""
Score and rank Gemini captions to select the best clips per fine-grained class.

Scoring:
  - keyword match: does the caption describe the right sound?
  - prominence: is that sound dominant/loud/close vs. background?
  - specificity: fewer labeled classes = cleaner, less cluttered recording
  - gt bonus: ground-truth annotation is more reliable than crowd label

Output: analysis/outputs/curated_manifest.json
  [{ "fine_class", "filename", "archive", "borough", "hour",
     "caption", "score", "gt", "classes" }, ...]

Usage:
  python analysis/analyze_captions.py             # full run
  python analysis/analyze_captions.py --summary   # print table only, no file write
"""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

CAPTIONS_PATH = Path('analysis/outputs/captions.jsonl')
OUTPUT_PATH   = Path('analysis/outputs/curated_manifest.json')

# how many clips to keep per class in the output manifest
TOP_N = 20
# if gt pool < this, also pull non-gt entries to fill up
SPARSE_THRESHOLD = 10

# keywords that suggest a sound is a foreground / prominent event
PROMINENCE = [
    'dominant', 'dominated', 'prominent', 'foreground', 'primary',
    'loud', 'clear', 'close', 'pronounced', 'main', 'distinct',
]

# per-class keyword lists — matched against caption text (lowercase)
KEYWORDS = {
    'small-sounding-engine':        ['scooter', 'motorcycle', 'moped', 'small engine', 'small vehicle', 'motorbike'],
    'medium-sounding-engine':       ['medium engine', 'car engine', 'sedan', 'passenger car', 'medium vehicle', 'car'],
    'large-sounding-engine':        ['large engine', 'bus', 'truck', 'heavy vehicle', 'large vehicle', 'diesel', 'lorry'],
    # rock-drill: clips often dominated by engine noise, Gemini rarely says "drill"
    'rock-drill':                   ['rock drill', 'drilling', 'drill', 'boring machine', 'construction machinery', 'construction'],
    # jackhammer: Gemini says "impact wrench", "percussive rhythm" — never "jackhammer"
    'jackhammer':                   ['jackhammer', 'jack hammer', 'pneumatic', 'impact wrench', 'hammering', 'pounding', 'percussive'],
    'hoe-ram':                      ['hoe-ram', 'hoe ram', 'excavator', 'hydraulic hammer', 'demolition'],
    'pile-driver':                  ['pile driver', 'piledriver', 'pile driving'],
    'non-machinery-impact':         ['bang', 'knock', 'thud', 'crash', 'slam', 'impact', 'clatter', 'metallic clang', 'clanking', 'clanging'],
    'chainsaw':                     ['chainsaw', 'chain saw', 'weed trimmer', 'power tool'],
    # saw: Gemini says "metallic grinding", "high-pitched whine" — not "saw"
    'small-medium-rotating-saw':    ['circular saw', 'rotating saw', 'angle grinder', 'saw', 'metallic grinding', 'high-pitched whine', 'whirring'],
    'large-rotating-saw':           ['large saw', 'large rotating saw', 'industrial saw', 'metallic grinding', 'grinding'],
    'car-horn':                     ['car horn', 'horn', 'honk', 'honking'],
    'car-alarm':                    ['car alarm', 'alarm'],
    'siren':                        ['siren', 'emergency vehicle', 'ambulance', 'police siren', 'fire truck', 'wail', 'wailing'],
    # reverse-beeper: Gemini says "rhythmic beeping", "reversing vehicle" — match those
    'reverse-beeper':               ['reverse beeper', 'reversing', 'backing up', 'beeping', 'beep', 'reversing alarm', 'reversing vehicle'],
    'stationary-music':             ['music', 'busker', 'playing music', 'musical', 'song'],
    # mobile-music: clips are often just background noise, Gemini rarely identifies moving music
    'mobile-music':                 ['mobile music', 'passing music', 'car stereo', 'music from a vehicle', 'music from a passing', 'musical track'],
    'ice-cream-truck':              ['ice cream truck', 'ice-cream truck', 'ice cream', 'jingle', 'chime', 'melodic'],
    'person-or-small-group-talking':['talking', 'conversation', 'speech', 'speaking', 'voices', 'chatter'],
    'person-or-small-group-shouting':['shouting', 'yelling', 'calling out', 'shout', 'exclamation'],
    'large-crowd':                  ['crowd', 'large crowd', 'many voices', 'cheering', 'crowd noise', 'group of people'],
    'amplified-speech':             ['amplified', 'megaphone', 'loudspeaker', 'announcement', 'public address', 'pa system'],
    'dog-barking-whining':          ['dog', 'bark', 'barking', 'whining', 'canine', 'yelp'],
}

ALL_CLASSES = list(KEYWORDS.keys())


def score_entry(entry, fine_class):
    caption = entry['caption'].lower()
    kws = KEYWORDS[fine_class]

    # keyword hits — longer phrases score higher (more specific)
    kw_score = 0
    for kw in kws:
        if kw in caption:
            kw_score += len(kw.split())  # "jackhammer" → 1, "pneumatic drill" → 2

    # prominence bonus
    prox_score = sum(1 for p in PROMINENCE if p in caption)

    # specificity: fewer co-labeled classes = less cluttered clip
    n_classes = max(len(entry.get('classes', [])), 1)
    specificity = 1.0 / n_classes

    # gt is required for primary pool, but add bonus for secondary pool mixing
    gt_bonus = 2.0 if entry.get('gt') else 0.0

    return round(kw_score * 2.0 + prox_score * 0.5 + specificity + gt_bonus, 3)


def load_captions():
    entries = []
    with open(CAPTIONS_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def kw_score_only(entry, fine_class):
    """return keyword hit count only (used for filtering)"""
    caption = entry['caption'].lower()
    return sum(len(kw.split()) for kw in KEYWORDS[fine_class] if kw in caption)


def select_clips(entries):
    # index by class — only gt entries have class labels
    gt_by_class = defaultdict(list)

    for e in entries:
        if not e.get('gt'):
            continue
        for cls in e.get('classes', []):
            if cls in KEYWORDS:
                gt_by_class[cls].append(e)

    results = {}
    summary_rows = []

    for cls in ALL_CLASSES:
        pool = list(gt_by_class[cls])

        scored = [
            {**e, '_score': score_entry(e, cls), '_kw': kw_score_only(e, cls)}
            for e in pool
        ]

        # prefer clips where caption actually mentions the sound
        kw_matched = [e for e in scored if e['_kw'] > 0]
        kw_matched.sort(key=lambda x: -x['_score'])

        # fall back to all scored entries if not enough keyword matches
        if len(kw_matched) < 3 and len(scored) > len(kw_matched):
            remainder = [e for e in scored if e['_kw'] == 0]
            remainder.sort(key=lambda x: -x['_score'])
            top = (kw_matched + remainder)[:TOP_N]
            warn = f'⚠ only {len(kw_matched)} kw-matched'
        else:
            top = kw_matched[:TOP_N]
            warn = ''

        results[cls] = [
            {
                'fine_class': cls,
                'filename':   e['filename'],
                'archive':    e['archive'],
                'borough':    e['borough'],
                'hour':       e['hour'],
                'classes':    e['classes'],
                'gt':         e.get('gt', False),
                'score':      e['_score'],
                'kw_matched': e['_kw'] > 0,
                'caption':    e['caption'],
            }
            for e in top
        ]

        top_score = top[0]['_score'] if top else 0
        n_kw = len(kw_matched)
        summary_rows.append((cls, len(pool), n_kw, len(top), top_score, warn))

    return results, summary_rows


def print_summary(rows):
    print(f'\n{"class":<35} {"gt pool":>8} {"kw match":>9} {"selected":>9} {"top score":>10}  note')
    print('-' * 82)
    for cls, n_pool, n_kw, n_sel, top_score, warn in sorted(rows, key=lambda x: x[1]):
        print(f'{cls:<35} {n_pool:>8} {n_kw:>9} {n_sel:>9} {top_score:>10.2f}  {warn}')


def print_sample(results):
    print('\n── sample top captions per class ──')
    for cls in ALL_CLASSES:
        clips = results[cls]
        if not clips:
            print(f'\n{cls}: NO CLIPS FOUND')
            continue
        print(f'\n{cls} (score={clips[0]["score"]:.2f}):')
        excerpt = clips[0]['caption'][:200].rstrip()
        print(f'  {excerpt}...' if len(clips[0]["caption"]) > 200 else f'  {excerpt}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--summary', action='store_true', help='print summary only, no file write')
    args = parser.parse_args()

    print(f'loading {CAPTIONS_PATH}...')
    entries = load_captions()
    print(f'  {len(entries)} captions loaded')

    results, summary_rows = select_clips(entries)

    print_summary(summary_rows)
    print_sample(results)

    total_selected = sum(len(v) for v in results.values())
    print(f'\ntotal selected: {total_selected} clips across {len(ALL_CLASSES)} classes')

    if not args.summary:
        flat = [clip for clips in results.values() for clip in clips]
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(flat, f, indent=2)
        print(f'saved → {OUTPUT_PATH}')
    else:
        print('(--summary mode: no file written)')


if __name__ == '__main__':
    main()
