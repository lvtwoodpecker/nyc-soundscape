# Dog Mode

Dog Mode is an opt-in “fun and chaotic” easter egg that temporarily hijacks audio + UI without mutating underlying persona data. It enters via a dog button on the map (two confirms), then runs an infinite loop of multi-channel dog clips and random Manhattan dog markers until the user hits a pinned exit.

## UX rules (current)

- Entry
   - Visible dog button overlay on the map.
   - Two native `confirm()` prompts (kept intentionally obnoxious).
- While active
   - Normal interactions are allowed (persona/timeline/hour changes), but they must not change audio.
   - Journey trail/dot are hidden.
   - The normal clock SVG is never visible.
   - The transcript/story area is not used: it is replaced by the Exit button.
- Exit
   - Stops dog audio loops.
   - Restores normal story rendering, normal clock, normal map visuals, and normal sound-row behavior.

## Clock replacement (current)

Dog Mode replaces the normal clock with a dedicated “dog stage” in the clock panel:

- `#dog-stage` (container)
   - `#dog-ring` (SVG): a green radial ring that reflects persona hourly dB (segment height varies by hour).
   - `#dog-clock` (IMG): the provided dog head asset.

Important: the dog ring is separate from the normal clock. It is rendered by Dog Mode code and does not reuse `drawClock()`.

## Architecture decisions

- `src/dogmode.js`
   - Owns the Dog Mode “engine”: multi-channel audio loops + marker spawn loop.
   - Does not own global UI text overrides.
- `src/dogmode_ui.js`
   - Owns Dog Mode text overrides and Dog-only UI rendering (`renderDogLegend`, `renderDogSoundsList`).
   - Owns Dog Mode clock-stage rendering: `renderDogRing({ persona, selectedHour, hourlyStats })`.
   - Owns moving the exit button into the transcript area during Dog Mode (and restoring it on exit).
- `src/main.js`
   - Owns lifecycle toggles (enter/exit), state gating, and ensures persona/hour changes update Dog Mode visuals.

## Gotcha: hiding the clock SVG

`#clock-svg` is an SVG element, so using the HTMLElement `.hidden` property is unreliable.

- Correct approach: set/unset the `hidden` attribute (e.g. `toggleAttribute('hidden', true)`) and rely on CSS `#clock-svg[hidden] { display:none }`.

## Relevant files (current)

- `index.html`
   - Adds `#dog-stage` containing `#dog-ring` + `#dog-clock`.
- `src/main.js`
   - Enter/exit wiring and hard gating so Dog Mode never shows the normal clock.
   - Calls `renderDogRing()` on persona select and hour updates.
- `src/dogmode.js`
   - Dog audio loops + Manhattan dog marker spawns.
- `src/dogmode_ui.js`
   - Text overrides + legend/sounds rendering + exit-button mount + dog ring rendering.
- `src/style.css`
   - Dog Mode wobble and layout for the dog stage.

## Verification checklist

1. Enter Dog Mode: dog button visible; two confirms required.
2. On enter: day playback pauses; normal audio stops; journey is hidden.
3. Clock panel: normal clock SVG is hidden; dog head shows; green dB ring shows around it.
4. Interactions: persona/hour changes do not change audio; dog ring updates with persona/hour.
5. Transcript area: exit button replaces transcript content during Dog Mode.
6. Exit: restores normal clock + story, with no lingering timers/markers/audio.

## Next plans (polish)

- Tune dog ring radii/spacing so it hugs the dog head cleanly across screen sizes.
- Confirm the exit button sizing looks good inside the story overlay on small viewports.
