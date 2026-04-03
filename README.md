# NYC Soundscape — A Day in the Life

**NYU Re/presenting Data: Urban Data Visualization Contest 2026**

[Live demo →](https://lvtwoodpecker.github.io/nyc-soundscape/)

---

## What it is

A radial 24-hour clock that maps the sonic texture of a New York City day, grounded in real acoustic sensor data. Eight NYU-connected New Yorkers travel through the city hour by hour — each stop plays a real audio clip from that neighborhood, drawn from the SONYC urban sensor network.

Select a persona, step through their day, and hear what the city actually sounds like at 3am in Bed-Stuy or 9am at Washington Square Park.

---

## How to use

- Pick a persona from the left panel
- Click any segment on the clock, or drag the timeline scrubber to jump to a specific hour
- Hit **AUTO-PLAY DAY** to move through all 24 hours automatically
- Hover over clock segments to see the sound breakdown for that hour

---

## The 8 Personas

| Name | Role | Home | Campus |
|------|------|------|--------|
| Maya | CS Undergrad | Elmhurst, Queens | NYU Tandon |
| Prof. Marcus | Urban Studies Faculty | Upper East Side | Washington Square |
| Keisha | Dog Walker / Student | West Village | Washington Square |
| Carlos | Facilities Crew | Sunset Park, Brooklyn | NYU Tandon |
| Amara | Music MFA · Busker | Bed-Stuy, Brooklyn | Washington Square |
| Dr. Lin | CUSP Researcher | Carroll Gardens, Brooklyn | NYU Tandon |
| Jordan | Night Security Guard | Bushwick, Brooklyn | NYU Tandon |
| Rosa | Food Cart Vendor | Lower East Side | Washington Square |

---

## Dataset

**SONYC Urban Sound Tagging Dataset v2.3**

> Bello, J.P., Mydlarz, C., Salamon, J., et al. *SONYC Urban Sound Tagging (SONYC-UST): A Multilabel Dataset from an Urban Acoustic Sensor Network.* Zenodo, 2020.
> DOI: [10.5281/zenodo.3966543](https://doi.org/10.5281/zenodo.3966543) · License: CC BY 4.0

~18,500 10-second recordings from 60+ acoustic sensors across Manhattan, Brooklyn, and Queens. Each clip is annotated for 23 fine-grained sound classes across 8 coarse groups by Zooniverse volunteers and SONYC ground-truth reviewers.

---

## How it was made

The raw `annotations.csv` (62,022 rows) was processed by `analysis/process_annotations.py` into per-borough, per-hour prevalence statistics and sensor locations.

All 18,510 clips were captioned using **Gemini 2.5 Flash-Lite** (see `analysis/caption_clips.py` for the prompt), then scored by `analysis/analyze_captions.py` to select the most audible, representative examples per sound class. Selected clips were extracted from the Zenodo archives, loudness-normalized to −16 LUFS with ffmpeg, and uploaded to Cloudflare R2.

The visualization is built with Vite + vanilla JS (11 ES modules). Sound prevalence and dB estimates are derived from the SONYC annotation data at runtime — no values are hardcoded.

Static files that should ship as-is, like the Statue of Liberty toggle SVG, live under `public/assets/` so they deploy cleanly on GitHub Pages.

---

## AI usage disclosure

This project was built with assistance from **Claude** (Anthropic) for code, architecture, and persona design. Audio clips were described using **Gemini 2.5 Flash-Lite** (Google); the captioning prompt is documented in `analysis/caption_clips.py` per contest disclosure requirements.

---

## Built with

Vite · Web Audio API · Cloudflare R2 · Google Fonts (DM Mono + Syne)
