# NYC Soundscape — Implementation Checklist

Deadline: **April 3, 2026 · 11:59pm**
Showcase: **April 9, 2026 @ 370 Jay, Room 1201**

---

## Done

- [x] Data pipeline (`analysis/process_annotations.py`) → `public/data/processed/*.json`
- [x] Vite + ES modules refactor (10 modules)
- [x] GitHub Pages deploy (CI/CD via GitHub Actions on push to main)
- [x] 5 personas with full 24h schedules, Manhattan-only, real SONYC data
- [x] Radial 24h clock (SVG, dB-scaled segments, sound colors, tooltip)
- [x] Cheap `updateClockHour()` partial update (only touches 2 paths + needle per hour)
- [x] Web Audio synthesis (9 sound types + flatline)
- [x] dB meter, waveform canvas, timeline scrubber, auto-play
- [x] SONYC audio archives downloaded to `audio/` (gitignored)
- [x] Cloudflare R2 bucket created: `soundscape-nyc`
  - Public URL: `https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev`
- [x] CLAP embeddings across all 18,500 clips → `analysis/outputs/embeddings.npy`
- [x] Gemini 2.5 Flash-Lite captions for all 18,510 clips → `analysis/outputs/captions.jsonl`
- [x] `analysis/analyze_captions.py` — scores/ranks captions per fine class → `analysis/outputs/curated_manifest.json`
- [x] `analysis/extract_clips.py` — extracts WAVs, converts to MP3 (loudnorm -16 LUFS), saves to `audio/curated/`
- [x] Manhattan SVG hex grid map (`src/neighborhoodmap.js`) with persona trail + diff tracking
- [x] Light/dark theme system (CSS custom properties, localStorage persist, overlay fade)
- [x] Sound colors theme-aware via `getSoundColor()` reading live CSS vars
- [x] Inline onboarding in left panel (replaces modal)
- [x] Responsive layout breakpoints (900px, 600px)
- [x] README.md written
- [x] DATA_DICTIONARY.md written
- [x] Persona hour descriptions rewritten (poetic, no raw stat citations)

---

## Remaining

### Audio — R2 upload
- [x] Upload curated clips to R2 bucket via `scripts/upload_to_r2.sh`
- [x] Populate `public/data/processed/clip-index.json` with public MP3 URLs
- [x] Test real clip playback in `src/audio.js` (replace synthesis with R2 + synthesis fallback)
- [x] Verify 7 sparse-class synthesis fallbacks still work: `car-alarm`, `ice-cream-truck`, `large-crowd`, `hoe-ram`, `pile-driver`, `amplified-speech`, `large-rotating-saw`

### Map
- [x] Verify all 5 persona lat/lng coordinates render within map bounds

### Polish
- [x] Test all 5 personas × 24 hours end to end
- [x] Verify audio playback across Chrome / Firefox / Safari
---

## Nice to Have
- [ ] Wire Gemini captions into UI: show caption text when a clip plays
- [ ] Borough comparison panel
- [ ] Export persona's day as shareable image
