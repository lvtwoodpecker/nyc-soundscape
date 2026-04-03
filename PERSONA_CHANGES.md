# Persona Changes — Audio Impact Log
> Updated: April 2026

This file tracks persona changes that affect audio synthesis or R2 clip selection.

---

## Removed: Keisha (Dog Walker / Student)

**Was:** soundFocus `['dog', 'voice', 'music', 'alert']`, home West Village
**Impact:** No audio files to delete — audio is indexed by sound class, not persona. But Keisha's dog-heavy focus meant `dog-barking` clips played frequently for her hours. Those hours (especially 7–9am WSP) now belong to the shared Manhattan data, unweighted.

---

## Added: Nadia (Rideshare Driver, Hell's Kitchen)

**soundFocus:** `['engine', 'alert', 'voice', 'music']`
**Active hours:** 18:00–05:00 (evening shift through overnight)
**Audio profile:** Engine-dominant all night. Alert signals persist. Voice collapses 51% → 3% between 21h and 05h.

**Fine classes most likely to play for Nadia:**
- `large-sounding-engine` — primary overnight
- `medium-sounding-engine` — secondary
- `car-horn`, `siren`, `car-alarm`, `reverse-beeper` — alert signals, especially h23–h03
- `talking`, `shouting`, `large-crowd` — voice class, h18–h22

**Synthesis fallback needed for:** no new classes. All Nadia sound types already have curated clips or synthesis defined.

---

## Changed: Amara (Busker → Jazz Vocalist)

**Was:** Music MFA / Busker, home Bed-Stuy (Brooklyn)
**Now:** Jazz Vocalist, home East Village (Manhattan), performs at Village Vanguard (West Village)

**soundFocus unchanged in character:** `['music', 'voice', 'alert', 'dog']`
**Borough changed:** 3 (Brooklyn) → 1 (Manhattan) for all hours
**Audio impact:** Manhattan music prevalence is much lower than Brooklyn (8% vs 42% peak). The synthesizer/clips for `stationary-music` and `mobile-music` will play less frequently for Amara now because the underlying data shows lower music prevalence. This is intentional — the contrast (she performs music in a city where the sensors barely capture it) is the narrative hook.

**No new clips needed.** The existing music class clips still apply.

---

## Changed: Carlos (Sunset Park → TriBeCa)

**Was:** Home Sunset Park, Brooklyn (borough 3 for h0–h6, h17–h23)
**Now:** Home TriBeCa, Manhattan (borough 1 all 24 hours)

**Audio impact:** Overnight/evening hours now pull from borough 1 data instead of borough 3. Brooklyn evening music (42.2% at 21h) no longer plays for Carlos — he hears Manhattan's engine-dominated overnight instead.

**No new clips needed.**

---

## Unchanged: Rosa, Prof. Marcus

No audio-significant changes. Same borough (1), same sound focus.

---

## Summary — R2 clip coverage check

All 5 personas now use borough 1 (Manhattan) exclusively. Clip classes needed:

| Class | Who needs it most |
|---|---|
| large-sounding-engine | Nadia (overnight), Carlos (commute), Rosa (pre-dawn) |
| jackhammer, rock-drill | Carlos (h7–h11) |
| large-rotating-saw | Carlos (h7–h8) |
| car-horn, siren | Nadia (overnight), all personas |
| stationary-music | Amara (h19–h22) |
| talking, large-crowd | Rosa, Marcus, Nadia |
| dog-barking | Marcus (h7–h8 UES walk) |
