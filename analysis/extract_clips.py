"""
Extract WAVs from SONYC archives and convert to MP3 for the curated clip set.

Reads:  analysis/outputs/curated_manifest.json
Output: audio/curated/<fine_class>/<fine_class>-01.mp3, -02.mp3, ...

Skips files that already exist (resumable). Groups by archive so each .tar.gz
is opened at most once.

Requirements: ffmpeg in PATH

Usage:
  python analysis/extract_clips.py
  python analysis/extract_clips.py --dry-run   # print plan, no extraction
"""

import argparse
import json
import os
import subprocess
import sys
import tarfile
import tempfile
from collections import defaultdict
from pathlib import Path

MANIFEST_PATH = Path('analysis/outputs/curated_manifest.json')
AUDIO_DIR     = Path('audio')
OUT_DIR       = Path('audio/curated')


def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print('ffmpeg not found — install with: brew install ffmpeg')
        sys.exit(1)


def wav_to_mp3(wav_path, mp3_path):
    subprocess.run([
        'ffmpeg', '-i', str(wav_path),
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-codec:a', 'libmp3lame', '-q:a', '2',
        '-ar', '44100',
        str(mp3_path), '-y', '-loglevel', 'error',
    ], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not args.dry_run:
        check_ffmpeg()

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    # assign output paths and number per class
    class_counters = defaultdict(int)
    plan = []  # list of (entry, mp3_out_path)

    for entry in manifest:
        cls = entry['fine_class']
        class_counters[cls] += 1
        n = class_counters[cls]
        mp3_out = OUT_DIR / cls / f'{cls}-{n:02d}.mp3'
        plan.append((entry, mp3_out))

    total = len(plan)
    existing = sum(1 for _, p in plan if p.exists())
    to_extract = total - existing

    print(f'manifest: {total} clips across {len(class_counters)} classes')
    print(f'already done: {existing}  |  to extract: {to_extract}')

    if args.dry_run:
        print('\n── plan (first 20) ──')
        for entry, mp3_out in plan[:20]:
            status = 'skip' if mp3_out.exists() else 'extract'
            print(f'  [{status}] {entry["fine_class"]} / {entry["filename"]} → {mp3_out.name}')
        return

    if to_extract == 0:
        print('all clips already extracted.')
        return

    # group pending items by archive number
    by_archive = defaultdict(list)
    for entry, mp3_out in plan:
        if not mp3_out.exists():
            by_archive[entry['archive']].append((entry, mp3_out))

    done = 0
    errors = 0

    for archive_num in sorted(by_archive.keys()):
        archive_path = AUDIO_DIR / f'audio-{archive_num}.tar.gz'
        items = by_archive[archive_num]

        if not archive_path.exists():
            print(f'  missing {archive_path}, skipping {len(items)} clips')
            errors += len(items)
            continue

        print(f'\narchive {archive_num} — {len(items)} clips to extract')

        # build set of filenames we need from this archive
        needed = {e['filename'] for e, _ in items}
        mp3_by_filename = {e['filename']: p for e, p in items}

        with tempfile.TemporaryDirectory() as tmpdir:
            with tarfile.open(archive_path, 'r:gz') as tf:
                members = [m for m in tf.getmembers() if Path(m.name).name in needed]
                if not members:
                    print(f'  no matching WAVs found in archive')
                    continue
                tf.extractall(tmpdir, members=members)

            for member in members:
                wav_path = Path(tmpdir) / member.name
                filename = wav_path.name
                mp3_out = mp3_by_filename[filename]
                mp3_out.parent.mkdir(parents=True, exist_ok=True)

                try:
                    wav_to_mp3(wav_path, mp3_out)
                    done += 1
                    print(f'  [{done}/{to_extract}] {mp3_out.relative_to(OUT_DIR)}')
                except subprocess.CalledProcessError as e:
                    print(f'  error converting {filename}: {e}')
                    errors += 1

    print(f'\ndone. {done} extracted, {existing} skipped, {errors} errors')
    print(f'clips in: {OUT_DIR}')


if __name__ == '__main__':
    main()
