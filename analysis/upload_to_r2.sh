#!/usr/bin/env bash
# Upload curated MP3 clips to Cloudflare R2 and generate clip-index.json.
#
# Requires: wrangler (authenticated via CLOUDFLARE_API_TOKEN)
# Run from project root after extract_clips.sh
#
# Usage: bash analysis/upload_to_r2.sh

set -e

BUCKET="soundscape-nyc"
PUBLIC_BASE="https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev"
OUT_DIR="audio/curated"
INDEX_PATH="public/data/processed/clip-index.json"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "CLOUDFLARE_API_TOKEN not set — run: export CLOUDFLARE_API_TOKEN=your_token"
  exit 1
fi

echo "uploading to R2 bucket: $BUCKET"

declare -A index

for label_dir in "$OUT_DIR"/*/; do
  label=$(basename "$label_dir")
  urls=()

  for mp3 in "$label_dir"*.mp3; do
    [ -f "$mp3" ] || continue
    key=$(basename "$mp3")
    url="$PUBLIC_BASE/$key"

    echo "  uploading $key..."
    wrangler r2 object put "$BUCKET/$key" --file "$mp3" 2>/dev/null

    urls+=("\"$url\"")
  done

  if [ ${#urls[@]} -gt 0 ]; then
    index["$label"]=$(IFS=,; echo "[${urls[*]}]")
  fi
done

# write clip-index.json
echo "{" > "$INDEX_PATH"
first=true
for label in "${!index[@]}"; do
  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$INDEX_PATH"
  fi
  printf '  "%s": %s' "$label" "${index[$label]}" >> "$INDEX_PATH"
done
echo "" >> "$INDEX_PATH"
echo "}" >> "$INDEX_PATH"

# pretty-print with python if available
python3 -c "
import json
with open('$INDEX_PATH') as f:
    data = json.load(f)
with open('$INDEX_PATH', 'w') as f:
    json.dump(data, f, indent=2)
print('clip-index.json written with', sum(len(v) for v in data.values()), 'total URLs')
" 2>/dev/null || echo "clip-index.json written"

echo ""
echo "done. R2 upload complete."
echo "clip-index.json → $INDEX_PATH"
