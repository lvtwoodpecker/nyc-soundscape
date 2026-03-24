# NYC Soundscape — A Day in the Life
> NYU Re/presenting Data: Urban Data Visualization Contest 2026
> Submission deadline: April 3, 2026 · Showcase: April 9, 2026 @ 370 Jay, Room 1201

---

## Code Style

- Comments should be short and natural — written like a human, not generated. No CamelCase in comments.
- No heavy section headers with dashes or decorative separators (e.g. no `# ── Section ──────`). Just a plain short comment if needed.
- Let the code speak; only comment where something isn't obvious.

## What This Project Is

An interactive web visualization built for the **NYU Urban Data Visualization Contest**. It tells the story of a day in the life of 8 NYU-connected personas, mapping their sonic journey across the city hour by hour using data from the **SONYC Urban Sound Tagging dataset**.

The core concept: a **radial 24-hour clock** (showing sound intensity and type per hour) is overlaid on a **Leaflet.js map of NYC** that animates the persona's physical journey through the city in real time. A right-side panel shows a live dB meter, waveform visualizer, and synthesized audio playback for each sound type.

---

## Scope Decisions (Feb 2026)

### Geographic focus
- **Two NYU campuses only**: Washington Square (Greenwich Village) + Tandon (Downtown Brooklyn/MetroTech)
- WSP zone: 32 sensors within 1km — excellent 24h coverage
- Tandon zone: 7 sensors within 1km — good daytime, thin overnight
- Queens: 1 sensor (near Elmhurst/Rego Park border, sensor 45) — sparse, daytime only, zero data 0–5am

### Low-data hours (Option A)
- Hours with < 50 annotations in the zone → visual "low data" indicator on UI
- Hours with **zero** sensor data (e.g. Maya overnight in Queens) → **faint flatline tone** instead of sound synthesis (like a hospital monitor — no signal)

### The 8 Personas

| # | Name | Role | Campus | Lives |
|---|---|---|---|---|
| 1 | Maya | Freshman CS undergrad | Tandon | Elmhurst, Queens (near sensor 45) |
| 2 | Prof. Marcus | Urban Studies faculty | WSP | Upper East Side, Manhattan |
| 3 | Keisha | Dog walker / part-time student | WSP | West Village, Manhattan |
| 4 | Carlos | Facilities/construction crew | Tandon | Sunset Park, Brooklyn |
| 5 | Amara | Music MFA / busker | WSP | Bed-Stuy, Brooklyn |
| 6 | Dr. Lin | CUSP research scientist | Tandon | Carroll Gardens, Brooklyn |
| 7 | Jordan | Night security guard | Tandon | Bushwick, Brooklyn |
| 8 | Rosa | Food cart vendor (WSP-adjacent) | WSP | Lower East Side, Manhattan |

### Key sound hooks per persona
- **Keisha** — dogs (4.5% prevalence in Manhattan, highest in dataset), buskers in WSP
- **Carlos** — jackhammer, rock drill, large rotating saw (almost all Manhattan/Tandon construction)
- **Amara** — stationary music (10.1% in Brooklyn!), mobile music, amplified speech
- **Jordan** — night shift; siren, car alarm, reverse beeper; sparse Tandon overnight data flagged
- **Rosa** — ice cream truck cameo at 4pm (0.7% peak hour), large crowd, mobile music
- **Maya** — flatline audio 0–5am (zero Queens sensor data); large engine on F train commute

---

## Dataset

**SONYC Urban Sound Tagging (SONYC-UST) v2.3**
- Zenodo record: https://zenodo.org/records/3966543
- DOI: 10.5281/zenodo.3966543
- Created by: NYU Music and Audio Research Lab + Center for Urban Science and Progress
- License: CC BY 4.0

### What the dataset contains
- ~18,500 10-second audio recordings from 60+ SONYC acoustic sensors across NYC
- Sensors located in **Manhattan, Brooklyn, and Queens** (borough codes 1, 3, 4)
- Each recording tagged with presence/absence of **23 fine-grained sound classes** grouped into **8 coarse classes**
- Spatiotemporal metadata: year, week, day, hour, borough, block, lat/lng (quantized to block level)
- Annotations from Zooniverse citizen science volunteers + verified SONYC team ground truth
- `annotations.csv` (14.5 MB) — the main data file; audio files are ~13 GB total

### Sound taxonomy (8 coarse classes → 23 fine classes)
```
1. engine          → small / medium / large engine
2. machinery       → rock drill / jackhammer / hoe-ram / pile driver
3. impact          → non-machinery impact
4. powered-saw     → chainsaw / small-medium rotating saw / large rotating saw
5. alert-signal    → car horn / car alarm / siren / reverse beeper
6. music           → stationary music / mobile music / ice cream truck
7. human-voice     → talking / shouting / large crowd / amplified speech
8. dog             → dog barking / whining
```

### Key annotation columns in annotations.csv
- `split` — train / validate / test
- `sensor_id` — unique sensor identifier
- `audio_filename` — filename of the 10-second clip
- `annotator_id` — positive = Zooniverse volunteer, negative = SONYC team, 0 = ground truth
- `year`, `week`, `day`, `hour` — temporal context (quantized)
- `borough`, `block`, `latitude`, `longitude` — spatial context (block-level)
- `<coarse_id>_<coarse_name>_presence` — 1/0/-1 per coarse class
- `<coarse_id>-<fine_id>_<fine_name>_presence` — 1/0/-1 per fine class
- `<coarse_id>-<fine_id>_<fine_name>_proximity` — near / far / notsure (citizen science only)

---

## Contest Requirements

- Must use at least one of the provided datasets (SONYC-UST is one of them ✓)
- Can supplement with additional data sources
- Any medium: map, graph, interactive tool, artwork
- Must include documentation (README + data dictionary)
- Generative AI use must be disclosed and prompts commented in code
- Judged on: ease of interpretation (20pts), information enrichment (10pts), elegance (10pts), originality & impact (10pts), documentation quality (20pts)

---

## Current Architecture

### Single-file app: `nyc-soundscape-v2.html`
Everything is in one self-contained HTML file. No build step, no dependencies to install — just open in a browser.

### External dependencies (CDN)
- **Leaflet.js 1.9.4** — map rendering (`leaflet.min.css` + `leaflet.min.js`)
- **Google Fonts** — `DM Mono` (monospace body) + `Syne` (display headings)

### Layout (CSS Grid)
```
┌─────────────────────────────────────────────────────────┐
│ HEADER — logo + persona name + dataset attribution       │
├──────────────┬──────────────────────────────┬───────────┤
│ LEFT PANEL   │ CENTER: LEAFLET MAP           │ RIGHT     │
│ 260px        │ (fills remaining space)       │ 280px     │
│              │                               │           │
│ 8 persona    │  ┌─ Radial clock overlay ─┐  │ dB meter  │
│ cards        │  │  bottom-left, 240×240  │  │ waveform  │
│              │  └────────────────────────┘  │ sounds    │
│              │                               │ play btn  │
│              │  Timeline scrubber (bottom)   │ legend    │
│              │  Journey strip (very bottom)  │           │
├──────────────┴──────────────────────────────┴───────────┤
│ STATUS BAR — coordinates + dB context                    │
└─────────────────────────────────────────────────────────┘
```

### Key JS systems
1. **`PERSONAS` array** — 8 personas × 24 hours, each hour has: `{ h, lat, lng, loc, sounds[], db, desc }`
2. **`drawClock()`** — SVG radial chart, segment height = dB level, color = dominant sound type
3. **`updateHour(h)`** — master orchestrator that triggers map pan, clock redraw, dB meter, sound playback, UI updates
4. **`updateMapForHour(h)`** — draws visited trail polyline + animated pulsing persona marker
5. **`buildFullPath()`** — draws dashed full-day route on persona select
6. **`playSoundType(type, db)`** — Web Audio API synthesis per sound category
7. **`drawWaveform()`** — canvas animation, uses AnalyserNode when audio is playing, ambient sine wave idle
8. **`toggleAutoPlay()`** — steps through all 24 hours at 3s intervals

### Color system (CSS variables + JS constants)
```js
const SC = {
  engine:    '#ff6b6b',   // red
  machinery: '#ff9f43',   // orange
  impact:    '#ffd32a',   // yellow
  saw:       '#26de81',   // green
  alert:     '#fd79a8',   // pink
  music:     '#a29bfe',   // purple
  voice:     '#74b9ff',   // blue
  dog:       '#55efc4',   // teal
};
```

### Map setup
- **Tile layer**: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- **Dark filter on tiles**: `filter: brightness(0.22) saturate(0.3) hue-rotate(200deg)` via CSS
- **Initial center**: `[40.730, -73.935]`, zoom 11
- On persona select: `map.fitBounds()` to the persona's full journey
- On hour change: `map.panTo()` smoothly to current location
- Persona marker: custom `L.divIcon` with pulsing CSS ring animation

### Audio synthesis (Web Audio API)
Each sound type has a distinct synthesized character — no real audio files yet.
Audio plays automatically on hour change (first sound in the list) and manually via click.

**TODO**: Replace synthesis with real clips from the Zenodo dataset.
Real audio files are at: `https://zenodo.org/records/3966543/files/audio-0.tar.gz` through `audio-18.tar.gz`
Each `.tar.gz` contains ~720MB of 10-second `.wav` files named like `00001.wav`.
To integrate: serve files locally or use pre-extracted URLs, then swap `playSoundType()` to use `AudioContext.decodeAudioData()`.

---

## The 8 Personas

All persona schedules are grounded in SONYC's actual borough coverage and sound taxonomy.
Each has 24 hours of real NYC coordinates + location names + sound tags + dB estimates.

| ID | Name | Role | Borough | Color |
|---|---|---|---|---|
| `sanitation` | Miguel | Sanitation Worker | Bronx | `#ff9f43` |
| `finance` | Priya | Finance Analyst | Manhattan (UWS) | `#74b9ff` |
| `teacher` | Donna | Public School Teacher | Brooklyn (Crown Heights) | `#a29bfe` |
| `nurse` | James | Night-Shift Nurse | Queens (Jackson Heights) | `#fd79a8` |
| `chef` | Aiko | Restaurant Chef | Chinatown / Soho | `#26de81` |
| `student` | Darius | College Student | Brooklyn → NYU Village | `#ffd32a` |
| `driver` | Fatima | Rideshare Driver | Queens (Jamaica / JFK) | `#ff6b6b` |
| `artist` | Sofia | Visual Artist | Bushwick, Brooklyn | `#55efc4` |

---

## Design System

**Aesthetic**: Clean data-art — dark background, neon/pastel accent colors, geometric precision.
Not a dashboard — more like an editorial data experience.

### Typography
- **Display / headings**: `Syne` (weight 700–800)
- **Body / data / labels**: `DM Mono` (weight 300–500)

### Color palette
```css
--bg:     #070810   /* near-black background */
--bg2:    #0d0f1a   /* slightly lighter bg */
--bg3:    #12152a   /* card backgrounds */
--text:   #e8eaf6   /* primary text */
--muted:  #5a5f8a   /* secondary / labels */
--border: #1e2240   /* borders / dividers */
--neon-a: #a29bfe   /* purple accent */
--neon-b: #74b9ff   /* blue accent */
--neon-c: #fd79a8   /* pink accent */
```

### Motion principles
- Map pans smoothly (`duration: 0.8s`) on every hour change
- dB meter animates with lerp (`+= (target - current) * 0.1`)
- Waveform is always animating (60fps canvas loop)
- Clock needle jumps to current hour
- Persona marker has a CSS pulse ring (`@keyframes ringOut`)

---

## Hosting Strategy

### Prototype (current target)
**GitHub Pages** — fully static, no backend needed.
- HTML + pre-processed JSON files only
- Web Audio API synthesis for sound (real clips stubbed out)
- `annotations.csv` is pre-processed offline → JSON committed to repo

### Stretch Goal — Real Audio
**Cloudflare R2** (10GB free, egress free) for curated SONYC audio clips.
- ~80 clips total (8 sound types × ~10 clips each)
- ~16MB total — well within free tier
- `data/processed/clip-index.json` maps `(sound_type, borough)` → R2 public URL
- `CLIP_URLS` object in HTML (empty for now, ready for wiring)
- Web Audio synthesis as fallback when no clip URL available

## Known Gaps / TODO

### High priority for contest submission
- [ ] **Data pipeline** — run `analysis/process_annotations.py` → `data/processed/*.json`
- [ ] **v2 HTML** — build `nyc-soundscape-v2.html` with Leaflet map + real JSON data
- [ ] **GitHub Pages deploy** — public URL before deadline
- [ ] **Documentation / README** — required by contest rules; must cite sources, describe process, list tools
- [ ] **Data dictionary** — required by contest rules

### Nice to have
- [ ] Sensor heatmap layer (toggle-able, real lat/lng from sensors.json)
- [ ] Add `proximity` data (near/far) to the sound chips
- [ ] Annotator agreement visualization (citizen science vs. verified ground truth)
- [ ] Mobile-responsive layout
- [ ] Add borough comparison panel
- [ ] Export / share a persona's day as an image

### Stretch goal — Real Audio (post-prototype)
- [ ] Curate ~80 representative SONYC clips from Zenodo archives
- [ ] Upload to Cloudflare R2, get public URLs
- [ ] Populate `clip-index.json` and wire `CLIP_URLS` in HTML
- [ ] Fallback to Web Audio synthesis when no clip found

---

## File Structure

```
/
├── nyc-soundscape-v2.html        ← main app (Leaflet map + real data)
├── nyc-soundscape.html           ← v1 (radial clock only, no map)
├── CLAUDE.md                     ← this file
├── TODO.md                       ← implementation checklist
├── README.md                     ← (TODO: write for contest submission)
├── analysis/
│   └── process_annotations.py   ← offline pipeline: CSV → JSON
└── data/
    ├── metadata/
    │   ├── annotations.csv       ← SONYC-UST v2.3 (14.5MB, gitignored)
    │   ├── dcase-ust-taxonomy.yaml
    │   └── README.md             ← dataset README from Zenodo
    └── processed/
        ├── hourly-stats.json     ← (generated) sound prevalence by borough + hour
        ├── sensors.json          ← (generated) sensor lat/lng locations
        └── clip-index.json       ← (stretch) (sound_type, borough) → R2 clip URL
```

---

## How to Run

Just open `nyc-soundscape-v2.html` in any modern browser. No server needed.
For audio to work, the browser needs a user gesture first (click anything) — this is a Web Audio API browser security requirement.

For local development with live reload:
```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Contest Submission Checklist

- [ ] Visualization complete
- [ ] Real SONYC audio clips integrated
- [ ] README.md written (process description, tools used, data sources cited)
- [ ] Data dictionary written
- [ ] AI usage documented (this project was designed with Claude claude.ai assistance — prompts should be commented in code per contest rules)
- [ ] Submitted via https://nyu.qualtrics.com/jfe/form/SV_7Nv5S3ocb2BTOnA before **April 3, 2026 at 11:59pm**
- [ ] RSVP for April 9 showcase at 370 Jay, Room 1201, 3–6pm

---

## Design Context

**Users**: NYU contest judges — professors, urban planners, data scientists. Academic audience, design-literate, looking for originality and insight over slickness.

**Brand personality**: Precise, evocative, nocturnal. Like looking at a city from a rooftop at 3am.

**Emotional goal**: Wonder at the city's hidden acoustic life. The feeling of eavesdropping on NYC.

**Anti-references**: Grafana/Tableau dashboards, generic dark-mode SaaS, AI-generated "neon on black" visualizations.

**Design principles**:
1. The 8 sound colors carry all the semantic meaning — they're the only accent colors; don't dilute them with chrome
2. The clock is sacred — everything else serves it
3. Restraint everywhere except where sound is present
4. The right panel should feel like a field recording kit, not a metrics panel
5. Delight = city sounds leaking into the interface