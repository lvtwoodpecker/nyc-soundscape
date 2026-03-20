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

total=$(find "$OUT_DIR" -name "*.mp3" | wc -l | tr -d ' ')
done=0

for mp3 in "$OUT_DIR"/*/*.mp3; do
  [ -f "$mp3" ] || continue
  key=$(basename "$mp3")
  done=$((done + 1))
  echo "  [$done/$total] $key"
  wrangler r2 object put "$BUCKET/$key" --file "$mp3" --remote 2>/dev/null
done

echo ""
echo "upload complete. building clip-index.json..."

# build clip-index.json with python (bash assoc arrays not available on macOS)
python3 - "$OUT_DIR" "$PUBLIC_BASE" "$INDEX_PATH" <<'PYEOF'
import sys, os, json

out_dir, public_base, index_path = sys.argv[1], sys.argv[2], sys.argv[3]

index = {}
for label in sorted(os.listdir(out_dir)):
    label_dir = os.path.join(out_dir, label)
    if not os.path.isdir(label_dir):
        continue
    urls = []
    for fname in sorted(os.listdir(label_dir)):
        if fname.endswith('.mp3'):
            urls.append(f"{public_base}/{fname}")
    if urls:
        index[label] = urls

with open(index_path, 'w') as f:
    json.dump(index, f, indent=2)

total = sum(len(v) for v in index.values())
print(f"clip-index.json written — {len(index)} classes, {total} URLs")
print(f"path: {index_path}")
PYEOF
