"""
Extract signal-level features from the 223 curated MP3 clips.

Runs in ~2 min. Quick sanity check before the full CLAP embedding run.

Output: analysis/librosa_features.json
  {
    "class-name": [
      { "file": "...", "onset_rate": 2.3, "rms_mean": 0.12, "rms_std": 0.08,
        "spectral_centroid_mean": 3200.0, "spectral_contrast_mean": 18.5,
        "zero_crossing_rate": 0.09, "borough": "1", "hour": 8, "score": 0.667 },
      ...
    ]
  }
"""

import json
import os
import warnings
warnings.filterwarnings('ignore')

import librosa
import numpy as np

CURATED_DIR = 'audio/curated'
MANIFEST_PATH = 'audio/curated/manifest.json'
OUTPUT_PATH = 'analysis/librosa_features.json'

SR = 22050  # resample to this for consistency


def extract_features(path):
    y, sr = librosa.load(path, sr=SR, mono=True)

    # onset rate — events per second (high = more activity)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_rate = len(onset_frames) / (len(y) / sr)

    # RMS energy — mean and std (std = dynamics)
    rms = librosa.feature.rms(y=y)[0]
    rms_mean = float(np.mean(rms))
    rms_std = float(np.std(rms))

    # spectral centroid — brightness of sound (higher = brighter/harsher)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_centroid_mean = float(np.mean(centroid))

    # spectral contrast — difference between peaks and valleys in spectrum
    # high contrast = foreground sound clearly above noise floor
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    spectral_contrast_mean = float(np.mean(contrast))

    # zero crossing rate — noisiness proxy (high = noisy/unpitched)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zero_crossing_rate = float(np.mean(zcr))

    return {
        'onset_rate': round(onset_rate, 3),
        'rms_mean': round(rms_mean, 4),
        'rms_std': round(rms_std, 4),
        'spectral_centroid_mean': round(spectral_centroid_mean, 1),
        'spectral_contrast_mean': round(spectral_contrast_mean, 3),
        'zero_crossing_rate': round(zero_crossing_rate, 4),
    }


def interestingness(feat):
    """simple weighted score — higher onset rate and dynamics = more interesting"""
    onset_norm = min(feat['onset_rate'] / 5.0, 1.0)  # cap at 5 onsets/sec
    dynamics_norm = min(feat['rms_std'] / 0.1, 1.0)   # cap at 0.1 std
    contrast_norm = min(feat['spectral_contrast_mean'] / 30.0, 1.0)
    return round(onset_norm * 0.4 + dynamics_norm * 0.35 + contrast_norm * 0.25, 3)


def main():
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    results = {}
    class_summaries = []

    total = sum(len(v) for v in manifest.values())
    done = 0

    for cls, clips in manifest.items():
        class_results = []
        for clip in clips:
            # MP3 filename is derived from WAV filename
            base = os.path.splitext(clip['filename'])[0]
            mp3_name = f"{cls}-{str(clips.index(clip) + 1).zfill(2)}.mp3"
            mp3_path = os.path.join(CURATED_DIR, cls, mp3_name)

            # try numbered name first, then fallback to any mp3 in the dir
            if not os.path.exists(mp3_path):
                dir_path = os.path.join(CURATED_DIR, cls)
                if os.path.isdir(dir_path):
                    files = sorted(f for f in os.listdir(dir_path) if f.endswith('.mp3'))
                    idx = clips.index(clip)
                    if idx < len(files):
                        mp3_path = os.path.join(dir_path, files[idx])
                    else:
                        done += 1
                        continue
                else:
                    done += 1
                    continue

            try:
                feat = extract_features(mp3_path)
            except Exception as e:
                print(f'  error: {mp3_path}: {e}')
                done += 1
                continue

            entry = {
                'file': os.path.basename(mp3_path),
                'borough': clip.get('borough'),
                'hour': clip.get('hour'),
                'score': clip.get('score'),
                'interestingness': interestingness(feat),
                **feat,
            }
            class_results.append(entry)
            done += 1
            print(f'  [{done}/{total}] {cls}/{entry["file"]}  onset={feat["onset_rate"]:.2f}/s  interest={entry["interestingness"]:.2f}')

        results[cls] = class_results

        if class_results:
            avg_interest = np.mean([c['interestingness'] for c in class_results])
            avg_onset = np.mean([c['onset_rate'] for c in class_results])
            class_summaries.append((cls, avg_interest, avg_onset, len(class_results)))

    # summary table
    print('\n── class summary (sorted by avg interestingness) ──')
    print(f'{"class":<30} {"interest":>8} {"onset/s":>8} {"n":>4}')
    for cls, interest, onset, n in sorted(class_summaries, key=lambda x: -x[1]):
        print(f'{cls:<30} {interest:>8.3f} {onset:>8.2f} {n:>4}')

    os.makedirs('analysis', exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(results, f, indent=2)
    print(f'\nsaved → {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
