"""
NYC Soundscape — Annotation Processing Pipeline
================================================
Transforms SONYC-UST v2.3 annotations.csv into static JSON files
consumed by the visualization at runtime.

Outputs:
  data/processed/hourly-stats.json  — sound prevalence + estimated dB by borough & hour
  data/processed/sensors.json       — unique sensor locations

Usage:
  python3 analysis/process_annotations.py

Source: SONYC-UST v2.3 — https://zenodo.org/records/3966543
License: CC BY 4.0

AI Assistance: This script was written with Claude claude.ai assistance.
Prompt: "Write a Python pipeline to process SONYC annotations.csv into
         hourly sound prevalence stats and sensor location JSON for a
         static web visualization."
"""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
ANNOTATIONS_CSV = ROOT / "data" / "metadata" / "annotations.csv"
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Sound type mapping: coarse column suffix → UI key ──────────────────────
# Columns in CSV: "1_engine_presence", "2_machinery-impact_presence", etc.
COARSE_MAP = {
    "1_engine_presence":           "engine",
    "2_machinery-impact_presence": "machinery",
    "3_non-machinery-impact_presence": "impact",
    "4_powered-saw_presence":      "saw",
    "5_alert-signal_presence":     "alert",
    "6_music_presence":            "music",
    "7_human-voice_presence":      "voice",
    "8_dog_presence":              "dog",
}

# ── Estimated dB contribution per sound type (based on typical urban levels)
# Used to compute a weighted dB proxy from prevalence rates.
# Sources: WHO Environmental Noise Guidelines, NYC DEP noise data.
DB_WEIGHT = {
    "engine":    78,   # traffic, idling trucks
    "machinery": 88,   # construction equipment
    "impact":    82,   # non-machinery bangs/drops
    "saw":       90,   # powered saws — loudest category
    "alert":     80,   # horns, sirens, alarms
    "music":     70,   # ambient music
    "voice":     65,   # speech
    "dog":       72,   # barking
}

# ── Borough names ──────────────────────────────────────────────────────────
BOROUGH_NAMES = {"1": "Manhattan", "3": "Brooklyn", "4": "Queens"}

# ── Accumulators ───────────────────────────────────────────────────────────
# Structure: {borough: {hour: {sound_type: [list of presence values 0 or 1]}}}
by_borough_hour = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
# Global (all boroughs combined): {hour: {sound_type: [...]}}
by_hour_global = defaultdict(lambda: defaultdict(list))

# Sensor locations: {sensor_id: {lat, lng, borough, block, n_clips}}
sensor_map = {}
sensor_clips = defaultdict(int)

print(f"Reading {ANNOTATIONS_CSV} ...")
total_rows = 0
skipped_rows = 0

with open(ANNOTATIONS_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames

    # Verify expected columns exist
    for col in COARSE_MAP:
        if col not in fieldnames:
            raise ValueError(f"Missing expected column: {col}")

    for row in reader:
        total_rows += 1

        # ── Skip rows where all coarse labels are -1 (unlabeled by this annotator)
        # -1 means the annotator only labeled other coarse groups (SONYC team partial annotations)
        presence_vals = [row[col] for col in COARSE_MAP]
        if all(v == "-1" for v in presence_vals):
            skipped_rows += 1
            continue

        # ── Extract temporal + spatial keys
        hour = row["hour"].strip()
        borough = row["borough"].strip()

        if not hour or not borough or borough not in BOROUGH_NAMES:
            skipped_rows += 1
            continue

        # ── Track sensor location
        sid = row["sensor_id"].strip()
        if sid and sid not in sensor_map:
            try:
                sensor_map[sid] = {
                    "sensor_id": sid,
                    "lat": float(row["latitude"]),
                    "lng": float(row["longitude"]),
                    "borough": int(borough),
                    "borough_name": BOROUGH_NAMES[borough],
                    "block": row["block"].strip(),
                }
            except (ValueError, KeyError):
                pass
        if sid:
            sensor_clips[sid] += 1

        # ── Accumulate presence values per (borough, hour, sound_type)
        for col, sound_type in COARSE_MAP.items():
            val = row[col].strip()
            if val in ("0", "1"):  # exclude -1 (unlabeled)
                presence = int(val)
                by_borough_hour[borough][hour][sound_type].append(presence)
                by_hour_global[hour][sound_type].append(presence)

print(f"  Total rows: {total_rows:,}")
print(f"  Skipped (all-unlabeled): {skipped_rows:,}")
print(f"  Unique sensors: {len(sensor_map)}")


# ── Helper: compute prevalence rates + estimated dB for one (borough, hour) ──
def compute_stats(sound_lists):
    """
    sound_lists: {sound_type: [0, 1, 1, 0, ...]}
    Returns: {sound_type: prevalence_rate}, estimated_db (float)
    """
    prevalence = {}
    for sound_type, vals in sound_lists.items():
        if vals:
            prevalence[sound_type] = round(sum(vals) / len(vals), 4)
        else:
            prevalence[sound_type] = 0.0

    # Weighted dB estimate using energy summation (decibel addition)
    # dB_total = 10 * log10( sum( 10^(dB_i/10) * prevalence_i ) )
    energy_sum = sum(
        (10 ** (DB_WEIGHT[st] / 10)) * prevalence.get(st, 0)
        for st in DB_WEIGHT
    )
    if energy_sum > 0:
        db_estimate = round(10 * math.log10(energy_sum), 1)
    else:
        db_estimate = 55.0  # quiet baseline

    # Dominant sound type (highest prevalence)
    dominant = max(prevalence, key=lambda k: prevalence[k]) if prevalence else None

    # Clip count (use the first sound type's list length as proxy)
    n = max((len(v) for v in sound_lists.values()), default=0)

    return prevalence, db_estimate, dominant, n


# ── Build hourly-stats.json ────────────────────────────────────────────────
print("\nBuilding hourly-stats.json ...")

# Global stats (all boroughs)
global_stats = {}
for hour in sorted(by_hour_global.keys(), key=int):
    prev, db, dominant, n = compute_stats(by_hour_global[hour])
    global_stats[hour] = {
        "prevalence": prev,
        "db": db,
        "dominant": dominant,
        "n_annotations": n,
    }

# Per-borough stats
borough_stats = {}
for borough in sorted(by_borough_hour.keys(), key=int):
    borough_stats[borough] = {}
    for hour in sorted(by_borough_hour[borough].keys(), key=int):
        prev, db, dominant, n = compute_stats(by_borough_hour[borough][hour])
        borough_stats[borough][hour] = {
            "prevalence": prev,
            "db": db,
            "dominant": dominant,
            "n_annotations": n,
        }

# Coverage summary (which hours have data per borough)
coverage = {b: sorted(list(by_borough_hour[b].keys()), key=int) for b in by_borough_hour}

hourly_stats = {
    "meta": {
        "source": "SONYC-UST v2.3",
        "doi": "10.5281/zenodo.3966543",
        "license": "CC BY 4.0",
        "n_rows_total": total_rows,
        "n_rows_used": total_rows - skipped_rows,
        "boroughs": BOROUGH_NAMES,
        "sound_types": list(COARSE_MAP.values()),
        "db_weights_reference": DB_WEIGHT,
    },
    "global": global_stats,
    "by_borough": borough_stats,
    "coverage": coverage,
    # Stub for stretch goal: (sound_type, borough) → clip URL
    # Populate clip-index.json separately when Cloudflare R2 is set up.
    "clip_index_url": "./clip-index.json",
}

out_path = OUT_DIR / "hourly-stats.json"
with open(out_path, "w") as f:
    json.dump(hourly_stats, f, separators=(",", ":"))
print(f"  Written: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


# ── Build sensors.json ─────────────────────────────────────────────────────
print("\nBuilding sensors.json ...")

sensors_list = []
for sid, info in sensor_map.items():
    info["n_clips"] = sensor_clips.get(sid, 0)
    sensors_list.append(info)

# Sort by borough then n_clips desc
sensors_list.sort(key=lambda s: (s["borough"], -s["n_clips"]))

out_path = OUT_DIR / "sensors.json"
with open(out_path, "w") as f:
    json.dump(sensors_list, f, separators=(",", ":"))
print(f"  Written: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
print(f"  Sensors: {len(sensors_list)} unique sensors")


# ── Build clip-index.json stub (for stretch goal) ─────────────────────────
print("\nBuilding clip-index.json stub ...")

clip_index_stub = {
    "_comment": (
        "Stretch goal: populate with real Cloudflare R2 URLs. "
        "Keys: sound_type → borough_code → clip URL. "
        "Borough codes: 1=Manhattan, 3=Brooklyn, 4=Queens."
    ),
    "engine":    {"1": None, "3": None, "4": None},
    "machinery": {"1": None, "3": None, "4": None},
    "impact":    {"1": None, "3": None, "4": None},
    "saw":       {"1": None, "3": None, "4": None},
    "alert":     {"1": None, "3": None, "4": None},
    "music":     {"1": None, "3": None, "4": None},
    "voice":     {"1": None, "3": None, "4": None},
    "dog":       {"1": None, "3": None, "4": None},
}

out_path = OUT_DIR / "clip-index.json"
with open(out_path, "w") as f:
    json.dump(clip_index_stub, f, indent=2)
print(f"  Written: {out_path} (stub — populate with R2 URLs for stretch goal)")


# ── Quick sanity check ─────────────────────────────────────────────────────
print("\n── Sanity check ───────────────────────────────────────────")
print("Global hour 8am (Manhattan commute):")
if "8" in global_stats:
    g = global_stats["8"]
    print(f"  dB estimate: {g['db']} dB")
    print(f"  Dominant sound: {g['dominant']}")
    top = sorted(g["prevalence"].items(), key=lambda x: -x[1])[:4]
    for st, rate in top:
        print(f"  {st:12s}: {rate:.1%}")

print("\nPer-borough hour 8am:")
for b, bname in BOROUGH_NAMES.items():
    if b in borough_stats and "8" in borough_stats[b]:
        s = borough_stats[b]["8"]
        print(f"  {bname:12s}: {s['db']} dB, dominant={s['dominant']}, n={s['n_annotations']}")

print("\nDone.")
