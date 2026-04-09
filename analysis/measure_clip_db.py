"""Measure pre-normalization RMS dBFS for each assigned clip and write it into clip-assignments.json.

For each clip in clip-assignments.json, finds the original WAV in the local Zenodo .tar.gz
archives, extracts it to a temp dir (without ffmpeg normalization), measures RMS dBFS with
librosa, then discards the WAV. Writes a "db" field back to each entry.

Run from project root:
  python analysis/measure_clip_db.py

Requires: librosa, numpy (already in analysis/.venv)
"""

from __future__ import annotations

import json
import tarfile
import tempfile
from collections import defaultdict
from pathlib import Path

import librosa
import numpy as np

ASSIGNMENTS_PATH = Path("public/data/processed/clip-assignments.json")
MANIFEST_PATH = Path("analysis/outputs/curated_manifest.json")
AUDIO_DIR = Path("audio")

# converts dBFS → estimated dB SPL using the SONYC sensor calibration offset
# derived by correlating per-clip RMS dBFS with hourly-stats.json dB SPL estimates
# across all 120 assigned clips (mean dBFS=-32.6, mean SPL=80.9 → offset=113.5)
SPL_OFFSET = 113.5


def rms_spl(wav_path: Path) -> float:
    y, _ = librosa.load(wav_path, sr=None, mono=True)
    rms = np.sqrt(np.mean(y ** 2))
    dbfs = 20 * np.log10(rms + 1e-9)
    return float(round(dbfs + SPL_OFFSET, 2))


def main() -> None:
    assignments = json.loads(ASSIGNMENTS_PATH.read_text())
    manifest = json.loads(MANIFEST_PATH.read_text())

    # build url -> original filename + archive number
    from collections import defaultdict as dd
    counters: dict[str, int] = defaultdict(int)
    url_to_meta: dict[str, dict] = {}
    for entry in manifest:
        cls = entry["fine_class"]
        counters[cls] += 1
        n = counters[cls]
        url = f"https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev/{cls}-{n:02d}.mp3"
        url_to_meta[url] = {"filename": entry["filename"], "archive": entry["archive"]}

    # group unique urls by archive so we open each tar.gz at most once
    archive_to_items: dict[int, list[tuple[str, str]]] = defaultdict(list)
    seen_urls: set[str] = set()
    for val in assignments.values():
        url = val["url"]
        if url in seen_urls:
            continue
        seen_urls.add(url)
        meta = url_to_meta.get(url)
        if meta is None:
            print(f"warning: no manifest entry for {url}")
            continue
        archive_to_items[meta["archive"]].append((url, meta["filename"]))

    # measure dBFS per unique url
    url_db: dict[str, float] = {}
    total_archives = len(archive_to_items)

    for i, (archive_num, items) in enumerate(sorted(archive_to_items.items()), 1):
        archive_path = AUDIO_DIR / f"audio-{archive_num}.tar.gz"
        if not archive_path.exists():
            print(f"[{i}/{total_archives}] missing {archive_path}, skipping {len(items)} clips")
            continue

        needed = {filename for _, filename in items}
        url_by_filename = {filename: url for url, filename in items}

        print(f"[{i}/{total_archives}] archive {archive_num} — {len(items)} clips")

        with tempfile.TemporaryDirectory() as tmpdir:
            with tarfile.open(archive_path, "r:gz") as tf:
                members = [m for m in tf.getmembers() if Path(m.name).name in needed]
                tf.extractall(tmpdir, members=members)

            for member in members:
                wav_path = Path(tmpdir) / member.name
                filename = wav_path.name
                url = url_by_filename[filename]
                db = rms_spl(wav_path)
                url_db[url] = db
                print(f"  {filename} → {db:.2f} dB SPL")

    # write db back to assignments
    updated = 0
    for entry in assignments.values():
        db = url_db.get(entry["url"])
        if db is not None:
            entry["db"] = db
            updated += 1

    ASSIGNMENTS_PATH.write_text(json.dumps(assignments, indent=2) + "\n")
    print(f"\nwrote db for {updated}/{len(assignments)} entries → {ASSIGNMENTS_PATH}")
    if updated < len(assignments):
        print(f"warning: {len(assignments) - updated} entries missing db (archive not found?)")


if __name__ == "__main__":
    main()
