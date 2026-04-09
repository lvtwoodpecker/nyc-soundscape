"""Compute RMS dBFS for each pre-assigned clip and write it into clip-assignments.json.

Reads local MP3 files from audio/curated/{fine_class}/{filename}.mp3 using the URL
to derive the local path. Adds a "db" field (dBFS, negative float) to each entry.

Run from project root:
  python analysis/compute_clip_db.py

Requires: librosa, numpy (already in analysis/.venv)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import librosa
import numpy as np

ASSIGNMENTS_PATH = Path("public/data/processed/clip-assignments.json")
CURATED_DIR = Path("audio/curated")


def url_to_local(url: str) -> Path | None:
    filename = url.split("/")[-1]  # e.g. large-sounding-engine-12.mp3
    stem = filename.removesuffix(".mp3")
    # fine_class = everything before the trailing -NN
    m = re.match(r"^(.+)-(\d{2})$", stem)
    if not m:
        return None
    fine_class = m.group(1)
    return CURATED_DIR / fine_class / filename


def rms_dbfs(path: Path) -> float:
    y, _ = librosa.load(path, sr=None, mono=True)
    rms = np.sqrt(np.mean(y ** 2))
    return float(round(20 * np.log10(rms + 1e-9), 2))


def main() -> None:
    assignments = json.loads(ASSIGNMENTS_PATH.read_text())

    # compute once per unique URL, reuse for duplicates
    url_db: dict[str, float] = {}
    missing: list[str] = []

    for key, entry in assignments.items():
        url = entry["url"]
        if url in url_db:
            continue
        local = url_to_local(url)
        if local is None or not local.exists():
            missing.append(f"{key} → {url}")
            continue
        url_db[url] = rms_dbfs(local)

    if missing:
        print(f"warning: {len(missing)} clips not found locally:")
        for m in missing:
            print(f"  {m}")

    updated = 0
    for entry in assignments.values():
        db = url_db.get(entry["url"])
        if db is not None:
            entry["db"] = db
            updated += 1

    ASSIGNMENTS_PATH.write_text(json.dumps(assignments, indent=2) + "\n")
    print(f"wrote db for {updated}/{len(assignments)} entries → {ASSIGNMENTS_PATH}")


if __name__ == "__main__":
    main()
