"""Build an hour-accurate clip-index.json for runtime clip picking.

Reads:  analysis/outputs/curated_manifest.json
Writes: public/data/processed/clip-index.json

The output keeps SONYC fine-class keys, but each clip entry includes:
  - url: public URL (R2)
  - borough: "1"|"3"|"4"
  - hour: 0..23
    - lat/lng: sensor block-level coordinates from sensors.json

This preserves the original hour metadata so the frontend can choose clips
from the correct time-of-day at the right location.

Usage:
  python analysis/build_clip_index.py
  python analysis/build_clip_index.py --base https://... --out public/data/processed/clip-index.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

try:
    import librosa
    import numpy as np
    _LIBROSA = True
except ImportError:
    _LIBROSA = False

DEFAULT_BASE = "https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev"
DEFAULT_MANIFEST = Path("analysis/outputs/curated_manifest.json")
DEFAULT_SENSORS = Path("public/data/processed/sensors.json")
DEFAULT_OUT = Path("public/data/processed/clip-index.json")
DEFAULT_CURATED = Path("audio/curated")


SPL_OFFSET = 113.5  # dBFS → estimated dB SPL, derived from SONYC sensor calibration


def rms_spl(path: Path) -> float | None:
    if not _LIBROSA or not path.exists():
        return None
    try:
        y, _ = librosa.load(path, sr=None, mono=True)
        rms = np.sqrt(np.mean(y ** 2))
        return float(round(20 * np.log10(rms + 1e-9) + SPL_OFFSET, 2))
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE, help="Public base URL for MP3s")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Path to curated_manifest.json")
    parser.add_argument("--sensors", default=str(DEFAULT_SENSORS), help="Path to sensors.json")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output clip-index.json path")
    parser.add_argument("--curated", default=str(DEFAULT_CURATED), help="Local curated audio dir")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    sensors_path = Path(args.sensors)
    out_path = Path(args.out)
    curated_dir = Path(args.curated)
    base = str(args.base).rstrip("/")

    with manifest_path.open() as f:
        manifest = json.load(f)
    with sensors_path.open() as f:
        sensors = json.load(f)

    sensor_lookup: dict[str, dict[str, object]] = {}
    for sensor in sensors:
        sid = str(sensor.get("sensor_id"))
        sensor_lookup[sid] = sensor

    counters: dict[str, int] = defaultdict(int)
    index: dict[str, list[dict[str, object]]] = {}
    missing_sensor = 0

    for entry in manifest:
        fine_class = entry["fine_class"]
        counters[fine_class] += 1
        n = counters[fine_class]

        mp3_name = f"{fine_class}-{n:02d}.mp3"
        url = f"{base}/{mp3_name}"

        # SONYC filename format: <sensor_id>_<clip_id>.wav
        sensor_id = str(entry.get("filename", "")).split("_", 1)[0].lstrip("0") or "0"
        sensor = sensor_lookup.get(sensor_id)
        lat = sensor.get("lat") if sensor else None
        lng = sensor.get("lng") if sensor else None
        if sensor is None:
            missing_sensor += 1

        local_path = curated_dir / fine_class / mp3_name
        db = rms_spl(local_path)

        clip_entry = {
            "url": url,
            "borough": str(entry.get("borough")) if entry.get("borough") is not None else None,
            "hour": int(entry["hour"]) if entry.get("hour") is not None else None,
            "lat": lat,
            "lng": lng,
        }
        if db is not None:
            clip_entry["db"] = db

        index.setdefault(fine_class, []).append(clip_entry)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as f:
        json.dump(index, f, indent=2)

    total = sum(len(v) for v in index.values())
    classes = len(index)
    print(f"Wrote {out_path} ({classes} classes, {total} clips)")
    if missing_sensor:
        print(f"Warning: {missing_sensor} clips missing sensor lat/lng mapping")


if __name__ == "__main__":
    main()
