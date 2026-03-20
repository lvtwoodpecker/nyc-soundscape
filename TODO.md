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

---

## Phase 1 — Real Audio (Priority)

**Goal:** Replace Web Audio synthesis with real SONYC clips. This is the centerpiece of the experience.

**Target:** 10 clips per fine-grained class × 23 classes = ~230 clips (~230MB on R2)

### Fine-grained classes to curate (23 total)
```
engine:    small-sounding-engine / medium-sounding-engine / large-sounding-engine
machinery: rock-drill / jackhammer / hoe-ram / pile-driver
impact:    non-machinery-impact
saw:       chainsaw / small-medium-rotating-saw / large-rotating-saw
alert:     car-horn / car-alarm / siren / reverse-beeper
music:     stationary-music / mobile-music / ice-cream-truck
voice:     talking / shouting / large-crowd / amplified-speech
dog:       dog-barking / dog-whining
```

### Steps
- [ ] Write `analysis/curate_clips.py`:
  - Read `annotations.csv`
  - Filter by fine-grained `presence=1`
  - Prefer ground-truth rows (`annotator_id=0`)
  - For each class, select top N clips ranked by annotation confidence
  - Output a manifest: `(fine_class, archive_number, filename)` for extraction
- [ ] Write `analysis/extract_clips.sh`:
  - For each entry in manifest, extract just that file from the matching `audio-N.tar.gz`
  - Save to `audio/curated/<fine_class>/`
- [ ] Convert WAV → MP3 at 128kbps (ffmpeg, ~10x size reduction)
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
  - Fallback to synthesis if no clip found (keeps noData flatline working)
- [ ] Update `src/personas.js` schedules: use fine-grained class names in `sounds[]` arrays where possible
- [ ] Test: each persona's full 24h journey plays real clips

### Expanding later
- Add borough-specific clips (same class, different sensor locations)
- Add more clips per class for more variety (no hard limit on R2)

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

- [ ] Annotator agreement visualization (citizen science vs. ground truth confidence)
- [ ] Borough comparison panel
- [ ] Proximity data (near/far) shown on sound chips
- [ ] Export persona's day as shareable image
