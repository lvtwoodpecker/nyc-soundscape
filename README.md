# NYC Soundscape
---

## What it is

A radial 24-hour clock that maps the sonic texture of a New York City day, grounded in real acoustic sensor data. Five NYU-connected New Yorkers travel through the city hour by hour, each stop plays a real audio clip from that neighborhood, drawn from the SONYC urban sensor network.

Select a persona, step through their day, and hear what the city actually sounds like.

---

## How to use

- Pick a persona from the left panel
- Click any segment on the clock, or drag the timeline scrubber to jump to a specific hour
- Hit **PLAY** to move through all 24 hours automatically
- Hover over clock segments to see the sound breakdown for that hour

---

## The 5 Personas

| Name | Role | Home | Campus |
|------|------|------|--------|
| Marcus | Music Tech Professor | Upper East Side | Washington Square |
| Nadia | Rideshare Driver | Hell's Kitchen | Washington Square |
| Eddie | Construction Crew | TriBeCa | NYU Tandon |
| Miura | Jazz Vocalist | East Village | Washington Square |
| Rosa | Food Cart Vendor | Lower East Side | Washington Square |

---

## Dataset

**SONYC Urban Sound Tagging Dataset v2.3**

> Bello, J.P., Mydlarz, C., Salamon, J., et al. *SONYC Urban Sound Tagging (SONYC-UST): A Multilabel Dataset from an Urban Acoustic Sensor Network.* Zenodo, 2020.
> DOI: [10.5281/zenodo.3966543](https://doi.org/10.5281/zenodo.3966543) · License: CC BY 4.0

~18,500 10-second recordings from 60+ acoustic sensors across Manhattan, Brooklyn, and Queens. Each clip is annotated for 23 fine-grained sound classes across 8 coarse groups by Zooniverse volunteers and SONYC ground-truth reviewers.

Data dictionary for processed files: `dist/data/DATA_DICTIONARY.md` (also in `public/data/DATA_DICTIONARY.md`).

---

## How to view / replay

**Recommended (no install):** download the submission package and run a local static server from the `dist/` folder:

`cd dist && python3 -m http.server 8080`

Then open http://localhost:8080

**Dev (optional):**

`npm install`
`npm run dev`

---

## How it was made

The raw `annotations.csv` (62,022 rows) was processed by `analysis/process_annotations.py` into per-borough, per-hour prevalence statistics and sensor locations.

All 18,510 clips were captioned using **Gemini 2.5 Flash-Lite** (see `analysis/caption_clips.py` for the prompt), then scored by `analysis/analyze_captions.py` to select the most audible, representative examples per sound class. Selected clips were extracted from the Zenodo archives, loudness-normalized to −16 LUFS with ffmpeg, and uploaded to Cloudflare R2.

The visualization is built with Vite + vanilla JS (11 ES modules). Sound prevalence and dB estimates are derived from the SONYC annotation data at runtime — no values are hardcoded.

---

## Other sources + tools

**Data + hosting:**

- Cloudflare R2 (hosts curated audio clips)
- GitHub Pages (live demo hosting)

**Software/tools used:**

- Vite + vanilla JS (frontend)
- Web Audio API (playback + synthesis fallbacks)
- Python (data processing + caption analysis scripts)
- ffmpeg loudness normalization (−16 LUFS)
- Google Fonts (Crimson Pro, DM Mono)

---

## Built with

Vite · Web Audio API · Cloudflare R2 · Google Fonts (DM Mono + Syne)
