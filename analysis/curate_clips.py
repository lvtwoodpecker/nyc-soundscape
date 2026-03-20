"""
Curate representative SONYC clips per fine-grained sound class.

Reads annotations.csv, scores each clip per class by annotator agreement,
then scans archive TOCs to map each filename to the correct archive.

Output: audio/curated/manifest.json
"""

import csv
import json
import os
import tarfile
from collections import defaultdict

CSV_PATH = 'public/data/metadata/annotations.csv'
AUDIO_DIR = 'audio'
MANIFEST_PATH = 'audio/curated/manifest.json'
CLIPS_PER_CLASS = 10

FINE_CLASSES = {
    '1-1_small-sounding-engine_presence':         'small-engine',
    '1-2_medium-sounding-engine_presence':        'medium-engine',
    '1-3_large-sounding-engine_presence':         'large-engine',
    '2-1_rock-drill_presence':                    'rock-drill',
    '2-2_jackhammer_presence':                    'jackhammer',
    '2-3_hoe-ram_presence':                       'hoe-ram',
    '2-4_pile-driver_presence':                   'pile-driver',
    '3-1_non-machinery-impact_presence':          'impact',
    '4-1_chainsaw_presence':                      'chainsaw',
    '4-2_small-medium-rotating-saw_presence':     'small-saw',
    '4-3_large-rotating-saw_presence':            'large-saw',
    '5-1_car-horn_presence':                      'car-horn',
    '5-2_car-alarm_presence':                     'car-alarm',
    '5-3_siren_presence':                         'siren',
    '5-4_reverse-beeper_presence':                'reverse-beeper',
    '6-1_stationary-music_presence':              'stationary-music',
    '6-2_mobile-music_presence':                  'mobile-music',
    '6-3_ice-cream-truck_presence':               'ice-cream-truck',
    '7-1_person-or-small-group-talking_presence': 'talking',
    '7-2_person-or-small-group-shouting_presence':'shouting',
    '7-3_large-crowd_presence':                   'large-crowd',
    '7-4_amplified-speech_presence':              'amplified-speech',
    '8-1_dog-barking-whining_presence':           'dog',
}


def build_archive_index():
    """scan all audio-N.tar.gz TOCs and return {filename -> archive_num}"""
    index = {}
    archives = sorted(
        f for f in os.listdir(AUDIO_DIR)
        if f.startswith('audio-') and f.endswith('.tar.gz')
    )
    print(f'scanning {len(archives)} archives...')
    for archive_file in archives:
        n = int(archive_file.replace('audio-', '').replace('.tar.gz', ''))
        path = os.path.join(AUDIO_DIR, archive_file)
        with tarfile.open(path, 'r:gz') as tf:
            for member in tf.getmembers():
                if member.name.endswith('.wav'):
                    fname = os.path.basename(member.name)
                    index[fname] = (n, member.name)  # (archive_num, in-archive path)
        print(f'  audio-{n}.tar.gz — {sum(1 for k,v in index.items() if v[0]==n)} files')
    return index


def load_votes():
    """aggregate annotator votes per (filename, fine-grained class)"""
    votes = defaultdict(lambda: defaultdict(lambda: {'yes': 0, 'no': 0, 'gt': False}))
    meta = {}

    print(f'reading {CSV_PATH}...')
    with open(CSV_PATH, newline='') as f:
        for row in csv.DictReader(f):
            fname = row['audio_filename']
            is_gt = row['annotator_id'] == '0'

            if fname not in meta:
                meta[fname] = {'borough': row['borough'], 'hour': int(row['hour'])}

            for col in FINE_CLASSES:
                val = row.get(col, '-1')
                if val == '1':
                    votes[fname][col]['yes'] += 1
                    if is_gt:
                        votes[fname][col]['gt'] = True
                elif val == '0':
                    votes[fname][col]['no'] += 1

    return votes, meta


def score(v):
    total = v['yes'] + v['no']
    return v['yes'] / total if total > 0 else 0.0


def select_clips(votes, meta, archive_index, col, n):
    candidates = []
    for fname, cols in votes.items():
        v = cols[col]
        s = score(v)
        # require majority agreement + at least 2 votes + file exists in our archives
        if s >= 0.5 and v['yes'] >= 2 and fname in archive_index:
            candidates.append((fname, s, v['gt'], meta.get(fname, {})))

    candidates.sort(key=lambda x: (x[2], x[1]), reverse=True)

    # pick top N with some borough variety
    selected = []
    borough_counts = defaultdict(int)
    for fname, s, gt, m in candidates:
        borough = m.get('borough', '?')
        if borough_counts[borough] < max(1, n // 3 + 1):
            archive_num, in_archive_path = archive_index[fname]
            selected.append({
                'filename': fname,
                'in_archive_path': in_archive_path,
                'archive': archive_num,
                'borough': borough,
                'hour': m.get('hour', -1),
                'score': round(s, 3),
                'gt': gt,
            })
            borough_counts[borough] += 1
        if len(selected) >= n:
            break

    # fill remaining without borough constraint
    if len(selected) < n:
        used = {c['filename'] for c in selected}
        for fname, s, gt, m in candidates:
            if fname not in used:
                archive_num, in_archive_path = archive_index[fname]
                selected.append({
                    'filename': fname,
                    'in_archive_path': in_archive_path,
                    'archive': archive_num,
                    'borough': m.get('borough', '?'),
                    'hour': m.get('hour', -1),
                    'score': round(s, 3),
                    'gt': gt,
                })
            if len(selected) >= n:
                break

    return selected


def main():
    os.makedirs('audio/curated', exist_ok=True)

    archive_index = build_archive_index()
    print(f'index built: {len(archive_index)} files across archives\n')

    votes, meta = load_votes()

    manifest = {}
    total = 0

    for col, label in FINE_CLASSES.items():
        clips = select_clips(votes, meta, archive_index, col, CLIPS_PER_CLASS)
        manifest[label] = clips
        found = len(clips)
        gt_count = sum(1 for c in clips if c['gt'])
        print(f'  {label:30s} {found:3d} clips  (gt: {gt_count})')
        total += found

    with open(MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f'\ntotal: {total} clips')
    print(f'manifest → {MANIFEST_PATH}')

    archives_needed = sorted({c['archive'] for clips in manifest.values() for c in clips})
    print(f'archives needed: {archives_needed}')


if __name__ == '__main__':
    main()
