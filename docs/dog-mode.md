# Dog Mode

Dog Mode is an opt-in easter egg that temporarily takes over audio, visuals, and copy without mutating persona schedule data.

Current flow:
- User picks a persona.
- Dog Mode button appears on the map, above the transcript section (bottom-right area).
- Enter requires one native confirm prompt.
- Dog clips and dog markers run until exit.

## UX rules (current)

- Entry
  - Dog button is hidden at startup.
  - Dog button becomes visible only after a persona is selected.
  - Dog button placement: map bottom-right, above transcript.
  - One native confirm prompt on entry.
- While active
  - Day playback pauses and normal audio is stopped.
  - Persona/timeline/hour interactions are still allowed, but Dog Mode audio loop stays in control.
  - Journey trail and dot are hidden.
  - Normal clock SVG is hidden; Dog stage is shown.
  - Transcript area content is replaced by the Dog Mode exit button.
  - Accent color is forced to dog green (no persona accent bleed-through).
- Exit
  - Stops dog audio loops and marker timers.
  - Restores normal story/transcript content and normal map/clock visuals.
  - If playback was running before Dog Mode, it resumes automatically.

## Clock replacement (current)

Dog Mode replaces the normal clock with a dedicated Dog stage in the clock panel:

- #dog-stage (container)
  - #dog-ring (SVG): radial ring using dog green. Segment height reflects hour dB.
  - #dog-clock (IMG): dog head asset with wobble animation.

The ring is rendered by Dog Mode code and is separate from normal drawClock rendering.

## Audio and marker engine

Dog Mode runs decoupled loops:
- Audio loops: multiple concurrent channels for barking clips.
- Visual loop: independent marker spawning cadence.

Current tuning is driven by state and constants:
- state.dogMode.channels controls concurrent audio channels.
- state.dogMode.markerCap controls max simultaneous map markers.
- Marker variant picker excludes recently used variants (last 5) to reduce repetition.
- Visual markers linger on timed removal and are not tied to clip end.

## Source ownership

- src/dogmode.js
  - Dog engine: channel loops, marker loop, marker lifecycle, cleanup.
- src/dogmode_ui.js
  - Text overrides, Dog-only legend/sounds, Dog ring rendering, and transcript exit-button mount/restore.
- src/main.js
  - Enter/exit lifecycle, playback pause/resume logic, mode gating, and Dog stage visibility.
- src/style.css
  - Dog stage visuals, wobble animation, Dog Mode accent overrides, button positioning.
- src/state.js
  - Dog Mode knobs: channels, markerCap, previousPlaybackState.

## Gotcha: hiding clock SVG

#clock-svg is an SVG element. Use hidden attribute toggling, not HTMLElement hidden assumptions.

- Correct pattern: toggleAttribute('hidden', true/false) and CSS #clock-svg[hidden] { display: none }.

## Verification checklist

1. Startup: Dog button is not visible before persona selection.
2. After selecting persona: Dog button appears above transcript at map bottom-right.
3. Enter Dog Mode: one confirm appears; normal playback pauses; journey trail/dot disappear.
4. Dog stage: normal clock hidden, dog head visible, green ring visible.
5. Transcript area: exit button is mounted in transcript area while in Dog Mode.
6. Color: Dog Mode UI accents stay dog green and do not inherit persona accent.
7. Exit: dog audio/markers stop, normal UI is restored, and playback resumes only if it was playing before entry.
