# NYC Soundscape — Implementation Checklist

Deadline: **April 3, 2026 · 11:59pm**
Showcase: **April 9, 2026 @ 370 Jay, Room 1201**

---

## Done

- [x] Data pipeline (`analysis/process_annotations.py`) → `public/data/processed/*.json`
- [x] Vite + ES modules refactor (11 modules, ~48KB minified)
- [x] GitHub Pages deploy (CI/CD via GitHub Actions on push to main)
- [x] 8 personas with full 24h schedules, real SONYC borough/hour data
- [x] Radial 24h clock (SVG, dB-scaled segments, sound colors, tooltip)
- [x] Web Audio synthesis (9 sound types + flatline for no-data hours)
- [x] dB meter, waveform canvas, timeline scrubber, auto-play
- [x] SONYC audio archives downloaded to `audio/` (gitignored)
- [x] Cloudflare R2 bucket created: `soundscape-nyc`
  - Public URL: `https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev`
- [x] CLAP embeddings across all 18,500 clips → `analysis/outputs/embeddings.npy`
- [x] Gemini 2.5 Flash-Lite captions for all 18,510 clips → `analysis/outputs/captions.jsonl`
- [x] `analysis/analyze_captions.py` — scores/ranks captions per fine class → `analysis/outputs/curated_manifest.json`
  - Key finding: SONYC gt-labels mean "sound was present" not "sound is audible/dominant"
  - 7 sparse classes (car-alarm, ice-cream-truck, large-crowd, hoe-ram, pile-driver, amplified-speech, large-rotating-saw) have no keyword-matched clips → synthesis fallback for those

---

## Phase 1 — Real Audio (Priority)

**Goal:** Replace Web Audio synthesis with real SONYC clips. This is the centerpiece of the experience.

**Target:** up to 10 clips per class for the 16 classes with audible examples; synthesis fallback for the 7 sparse/inaudible classes.

### Steps
- [x] Write `analysis/extract_clips.py` — reads curated_manifest.json, extracts WAVs from archives, converts to MP3 (loudnorm -16 LUFS, 128kbps), saves to `audio/curated/<fine_class>/`
- [ ] Upload to R2 bucket `soundscape-nyc` via wrangler CLI
- [ ] Populate `public/data/processed/clip-index.json`:
  ```json
  {
    "small-sounding-engine": [
      "https://pub-64ca4e71668742ceab6b2c679a8ff9ca.r2.dev/small-sounding-engine-01.mp3",
      ...
    ],
    "jackhammer": [...],
    ...
  }
  ```
- [ ] Update `src/audio.js`:
  - Load `clip-index.json` at startup
  - `playSound(fineClass, db)` → pick random clip from matching array → `AudioContext.decodeAudioData` → play
  - Fallback to synthesis if no clip found (keeps noData flatline working for sparse classes)
- [ ] Update `src/personas.js` schedules: use fine-grained class names in `sounds[]` arrays where possible
- [ ] Test: each persona's full 24h journey plays real clips

### Future
- Wire Gemini captions into UI: when a clip plays, show its caption text as a "what you're hearing" tooltip or card
- Add borough-specific clips (same class, different sensor locations)

---

## Phase 2 — Leaflet Map

**Goal:** The radial clock overlaid on an animated NYC map — personas physically move through the city.

- [ ] Add Leaflet.js 1.9.4 (CDN) to `index.html`
- [ ] Replace center panel clock-only layout with map + clock overlay
- [ ] On persona select: `map.fitBounds()` to their full route
- [ ] On hour change: `map.panTo()` smoothly to current location
- [ ] Persona marker: custom `L.divIcon` with pulsing CSS ring
- [ ] Full-day dashed route polyline on persona select
- [ ] Visited trail polyline (solid, colored) that grows as hours advance
- [ ] Sensor heatmap layer (toggle, uses `sensors.json`)
- [ ] Dark map tiles: OSM with `filter: brightness(0.22) saturate(0.3) hue-rotate(200deg)`

---

## Phase 3 — Documentation (Contest-Required)

- [ ] Write `README.md`:
  - Live URL + screenshot
  - Project description + persona concept
  - SONYC-UST citation (DOI: 10.5281/zenodo.3966543, CC BY 4.0)
  - Process description (pipeline → visualization)
  - AI usage disclosure (Claude assisted — required by contest rules)
- [ ] Write `public/data/DATA_DICTIONARY.md`:
  - `hourly-stats.json` field descriptions
  - `sensors.json` field descriptions
  - Mapping to original `annotations.csv` columns

---

## Phase 4 — Polish

- [ ] Refine persona hour descriptions for key sound hooks (Keisha/dogs, Carlos/construction, etc.)
- [ ] Mobile-responsive layout (at minimum, don't break on small screens)
- [ ] Test all 8 personas × 24 hours end to end
- [ ] Verify audio clip playback across Chrome / Firefox / Safari
- [ ] Submit via https://nyu.qualtrics.com/jfe/form/SV_7Nv5S3ocb2BTOnA

---

## Nice to Have (Post-Submission)

- [ ] Borough comparison panel
- [ ] Proximity data (near/far) shown on sound chips
- [ ] Export persona's day as shareable image
