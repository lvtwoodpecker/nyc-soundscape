#!/usr/bin/env bash
# Upload curated MP3 clips to Cloudflare R2 and generate clip-index.json.
#
# Only uploads from directories matching the 23 SONYC fine-class names in
# analysis/outputs/curated_manifest.json — skips old short-named dirs.
#
# Requires: wrangler (authenticated via CLOUDFLARE_API_TOKEN), jq
# Run from project root after analysis/extract_clips.py
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=your_token
#   bash scripts/upload_to_r2.sh

set -e

BUCKET="soundscape-nyc"
PUBLIC_BASE="https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev"
CURATED_DIR="audio/curated"
MANIFEST="analysis/outputs/curated_manifest.json"
INDEX_PATH="public/data/processed/clip-index.json"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "CLOUDFLARE_API_TOKEN not set — run: export CLOUDFLARE_API_TOKEN=your_token"
  exit 1
fi

command -v jq >/dev/null || { echo "jq required: brew install jq"; exit 1; }

# get the 23 SONYC fine-class names from the manifest
classes=$(jq -r '.[].fine_class' "$MANIFEST" | sort -u)
total=$(find $CURATED_DIR -name "*.mp3" | grep -f <(echo "$classes" | sed 's|^|/|') | wc -l | tr -d ' ')
done=0

echo "uploading to R2 bucket: $BUCKET"

for cls in $classes; do
  dir="$CURATED_DIR/$cls"
  [ -d "$dir" ] || continue
  for mp3 in "$dir"/*.mp3; do
    [ -f "$mp3" ] || continue
    key=$(basename "$mp3")
    done=$((done + 1))
    echo "  [$done] $key"
    wrangler r2 object put "$BUCKET/$key" --file "$mp3" --remote 2>/dev/null
  done
done

echo ""
echo "upload complete. building clip-index.json..."

python3 - "$CURATED_DIR" "$PUBLIC_BASE" "$INDEX_PATH" "$MANIFEST" <<'PYEOF'
import sys, os, json

curated_dir, public_base, index_path, manifest_path = sys.argv[1:]

with open(manifest_path) as f:
    manifest = json.load(f)

classes = sorted({e['fine_class'] for e in manifest})

index = {}
for cls in classes:
    cls_dir = os.path.join(curated_dir, cls)
    if not os.path.isdir(cls_dir):
        continue
    urls = [
        f"{public_base}/{fname}"
        for fname in sorted(os.listdir(cls_dir))
        if fname.endswith('.mp3')
    ]
    if urls:
        index[cls] = urls

with open(index_path, 'w') as f:
    json.dump(index, f, indent=2)

total = sum(len(v) for v in index.values())
print(f"clip-index.json written — {len(index)} classes, {total} URLs")
print(f"path: {index_path}")
PYEOF
