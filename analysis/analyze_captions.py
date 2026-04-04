"""
Score and rank captions to select the best clips per fine-grained class.

Scoring (preferred): Ollama labels from label_captions.py
  - dominant/confidence score from LLM evaluation of each caption
  - gt bonus, specificity

Scoring (fallback, if labeled_captions.jsonl not available):
  - keyword match: does the caption describe the right sound?
  - prominence: is that sound dominant/loud/close vs. background?
  - specificity: fewer labeled classes = cleaner, less cluttered recording

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

CAPTIONS_PATH  = Path('analysis/outputs/captions.jsonl')
LABELED_PATH   = Path('analysis/outputs/labeled_captions.jsonl')
OUTPUT_PATH    = Path('analysis/outputs/curated_manifest.json')

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


def load_labeled_captions():
    """load ollama-labeled captions if available. returns {filename: labels_dict} or None."""
    if not LABELED_PATH.exists():
        return None
    labeled = {}
    with open(LABELED_PATH) as f:
        for line in f:
            e = json.loads(line.strip())
            labeled[e['filename']] = e.get('labels', {})
    print(f'loaded {len(labeled)} ollama-labeled entries from {LABELED_PATH}')
    return labeled


def score_entry_labeled(entry, fine_class, labels_map):
    """score using ollama labels — present+dominant clips float to the top."""
    label      = labels_map.get(entry['filename'], {}).get(fine_class, {})
    present    = label.get('present', False)
    dominant   = label.get('dominant', False)
    confidence = float(label.get('confidence', 0.5))

    n_classes   = max(len(entry.get('classes', [])), 1)
    specificity = 1.0 / n_classes
    gt_bonus    = 2.0 if entry.get('gt') else 0.0

    if not present:
        dominance_score = 0.0
    elif dominant:
        dominance_score = confidence
    else:
        dominance_score = confidence * 0.15  # background but confirmed present

    return round(dominance_score * 3.0 + specificity + gt_bonus, 3)


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


def load_nongt_labeled_entries():
    """load non-gt entries from labeled_captions.jsonl — they have class labels from ollama."""
    if not LABELED_PATH.exists():
        return defaultdict(list)
    nongt_by_class = defaultdict(list)
    with open(LABELED_PATH) as f:
        for line in f:
            e = json.loads(line.strip())
            if e.get('gt'):
                continue
            for cls in e.get('classes', []):
                if cls in KEYWORDS:
                    nongt_by_class[cls].append(e)
    return nongt_by_class


def select_clips(entries, labels_map=None):
    using_labels = labels_map is not None

    # index by class — only gt entries have class labels in captions.jsonl
    gt_by_class = defaultdict(list)
    for e in entries:
        if not e.get('gt'):
            continue
        for cls in e.get('classes', []):
            if cls in KEYWORDS:
                gt_by_class[cls].append(e)

    # non-gt entries are only available via labeled_captions.jsonl (have ollama-assigned classes)
    nongt_by_class = load_nongt_labeled_entries() if using_labels else defaultdict(list)

    results = {}
    summary_rows = []

    for cls in ALL_CLASSES:
        pool = list(gt_by_class[cls])
        # supplement sparse gt pools with labeled non-gt entries
        if using_labels and len(pool) < SPARSE_THRESHOLD:
            pool = pool + nongt_by_class[cls]

        if using_labels:
            # check how many of this pool actually have ollama labels
            labeled_pool = [e for e in pool if e['filename'] in labels_map]
            use_labels = len(labeled_pool) >= 3
        else:
            use_labels = False

        if use_labels:
            scored = [
                {**e, '_score': score_entry_labeled(e, cls, labels_map), '_kw': 1}
                for e in labeled_pool
            ]
            scored.sort(key=lambda x: -x['_score'])
            # prefer dominant, fall back to any present, then all scored
            dominant = [e for e in scored if labels_map.get(e['filename'], {}).get(cls, {}).get('dominant', False)]
            present  = [e for e in scored if labels_map.get(e['filename'], {}).get(cls, {}).get('present', False)]
            if len(dominant) >= 3:
                top = dominant[:TOP_N]
            elif len(present) >= 3:
                top = present[:TOP_N]
            else:
                top = scored[:TOP_N]
            warn = f'ollama ({len(labeled_pool)} labeled, {len(dominant)} dominant, {len(present)} present)'
        else:
            scored = [
                {**e, '_score': score_entry(e, cls), '_kw': kw_score_only(e, cls)}
                for e in pool
            ]
            kw_matched = [e for e in scored if e['_kw'] > 0]
            kw_matched.sort(key=lambda x: -x['_score'])

            if len(kw_matched) < 3 and len(scored) > len(kw_matched):
                remainder = [e for e in scored if e['_kw'] == 0]
                remainder.sort(key=lambda x: -x['_score'])
                top = (kw_matched + remainder)[:TOP_N]
                warn = f'⚠ keyword fallback ({len(kw_matched)} matched)'
            else:
                top = kw_matched[:TOP_N]
                warn = 'keyword'

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
                'kw_matched': bool(e['_kw']),
                'caption':    e['caption'],
            }
            for e in top
        ]

        top_score = top[0]['_score'] if top else 0
        summary_rows.append((cls, len(pool), len(top), top_score, warn))

    return results, summary_rows


def print_summary(rows):
    print(f'\n{"class":<35} {"gt pool":>8} {"selected":>9} {"top score":>10}  note')
    print('-' * 82)
    for cls, n_pool, n_sel, top_score, warn in sorted(rows, key=lambda x: x[1]):
        print(f'{cls:<35} {n_pool:>8} {n_sel:>9} {top_score:>10.2f}  {warn}')


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

    labels_map = load_labeled_captions()
    if labels_map:
        print(f'  using ollama labels for scoring')
    else:
        print(f'  {LABELED_PATH} not found — falling back to keyword scoring')
        print(f'  run label_captions.py first for better results')

    results, summary_rows = select_clips(entries, labels_map)

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
