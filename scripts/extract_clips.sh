#!/usr/bin/env bash
# Extract curated clips from SONYC archives and convert WAV -> MP3.
#
# Requires: jq, ffmpeg
# Run from project root after curate_clips.py generates audio/curated/manifest.json
#
# Usage: bash analysis/extract_clips.sh

set -e

MANIFEST="audio/curated/manifest.json"
AUDIO_DIR="audio"
OUT_DIR="audio/curated"

if [ ! -f "$MANIFEST" ]; then
  echo "manifest not found — run curate_clips.py first"
  exit 1
fi

command -v jq >/dev/null || { echo "jq required: brew install jq"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg required: brew install ffmpeg"; exit 1; }

total=$(jq '[.[] | length] | add' "$MANIFEST")
echo "extracting and converting $total clips..."
done=0
skipped=0

for label in $(jq -r 'keys[]' "$MANIFEST"); do
  mkdir -p "$OUT_DIR/$label"
  count=$(jq -r ".[\"$label\"] | length" "$MANIFEST")

  for i in $(seq 0 $((count - 1))); do
    filename=$(jq -r ".[\"$label\"][$i].filename" "$MANIFEST")
    in_path=$(jq -r ".[\"$label\"][$i].in_archive_path" "$MANIFEST")
    archive=$(jq -r ".[\"$label\"][$i].archive" "$MANIFEST")
    archive_file="$AUDIO_DIR/audio-${archive}.tar.gz"
    mp3_out="$OUT_DIR/$label/${label}-$(printf '%02d' $((i+1))).mp3"

    if [ -f "$mp3_out" ]; then
      skipped=$((skipped+1))
      done=$((done+1))
      continue
    fi

    if [ ! -f "$archive_file" ]; then
      echo "  missing $archive_file, skipping"
      done=$((done+1))
      continue
    fi

    # extract just this one file (cd to /tmp first — macOS tar doesn't support -C with specific members)
    (cd /tmp && tar -xzf "$OLDPWD/$archive_file" "$in_path") 2>/dev/null || {
      echo "  failed to extract $in_path"
      done=$((done+1))
      continue
    }

    wav_tmp="/tmp/$in_path"

    # convert to MP3, normalize loudness to -16 LUFS
    ffmpeg -i "$wav_tmp" \
      -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
      -codec:a libmp3lame -q:a 2 \
      -ar 44100 \
      "$mp3_out" -y -loglevel error

    rm -f "$wav_tmp"
    done=$((done+1))
    echo "  [$done/$total] $label/$(basename $mp3_out)"
  done
done

echo ""
echo "done. $((done - skipped)) new clips extracted, $skipped already existed"
echo "clips in: $OUT_DIR"
