import { state } from './state.js'
import { PERSONAS, getSoundColor } from './personas.js'
import { drawClock, updateClockHour, pickVisualSound, rankSounds, MIN_SOUND_PREVALENCE } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, renderStory, animateDbMeter, setPlayingColor } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx, loadClipIndex, setMasterVolume, stopAllSounds, onPlaybackStateChange, isAudioPlaying, clipAssignments, prefetchClip } from './audio.js'
import { resizeWaveform, drawWaveform, setWaveformActive } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'
import { initNeighborhoodMap, updateNeighborhoodMap, resetNeighborhoodMap, refreshNeighborhoodMapTheme, setJourneyVisible } from './neighborhoodmap.js'
import { startDogMode, stopDogMode, getDogModeColor } from './dogmode.js'
import { applyDogModeTextOverrides, clearDogModeTextOverrides, renderDogLegend, renderDogSoundsList, renderDogRing } from './dogmode_ui.js'

const THEME_KEY = 'nyc-soundscape-theme'
let themeTransitionLock = false
const DAY_STEP_MS = 7000

window.updateHourGlobal = (h) => {
  jumpToHourManual(h).catch(err => console.warn('manual jump failed', err))
}
window.selectPersonaGlobal = (id) => selectPersona(id, { fromUser: false })

// wrapper so clicking a sound row also updates playing state + color
window.playSoundGlobal = (type, db, borough) => {
  manualSoundOverride(type, db, borough)
}

function clearDayPlaybackTimer() {
  if (state.dayPlaybackTimer) {
    clearTimeout(state.dayPlaybackTimer)
    state.dayPlaybackTimer = null
  }
}

function updateDayTransportUI() {
  const btn = document.getElementById('day-transport-btn')
  const autoplayToggle = document.getElementById('autoplay-toggle')
  const autoplayWrap = document.getElementById('autoplay-toggle-wrap')
  const hasPersona = !!state.persona
  const isPlaying = state.dayPlaybackState === 'playing'
  const isDogMode = state.dogModeActive

  if (btn) {
    btn.disabled = isDogMode
    if (!isDogMode) btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play'
    btn.setAttribute('aria-pressed', String(isPlaying))
  }

  if (autoplayWrap) autoplayWrap.hidden = !hasPersona

  if (autoplayToggle) {
    autoplayToggle.disabled = !hasPersona || isDogMode
    autoplayToggle.checked = state.autoplayEnabled
  }
}

function pauseDayPlayback({ keepHour = true } = {}) {
  clearDayPlaybackTimer()
  state.dayPlaybackState = 'paused'
  if (!keepHour) state.hour = 0
  stopAllSounds(true)
  setWaveformActive(false, state.lastSoundColor || undefined)
  animateDbMeter(0, { forceColor: state.lastSoundColor || '#888884' })
  updateDayTransportUI()
}

function scheduleNextDayStep() {
  clearDayPlaybackTimer()
  state.dayPlaybackTimer = setTimeout(() => {
    if (state.dayPlaybackState !== 'playing' || !state.persona || !state.autoplayEnabled) return

    const nextHour = (state.hour + 1) % 24
    updateHour(nextHour)
    scheduleNextDayStep()
  }, DAY_STEP_MS)
}

async function startDayPlayback() {
  if (!state.persona) return
  state.dayPlaybackState = 'playing'
  // If resuming with a manually selected sound from this hour, replay that instead of defaults
  if (state.manualSoundSelection && state.manualSoundSelection.hour === state.hour) {
    const { type, db, borough } = state.manualSoundSelection
    playSound(type, db, borough)
  } else {
    updateHour(state.hour)
  }
  updateDayTransportUI()
  if (state.autoplayEnabled) scheduleNextDayStep()
}

async function toggleDayPlayback() {
  if (state.dogModeActive) return
  // Auto-select first persona if none selected
  if (!state.persona) {
    if (typeof window.selectPersonaGlobal === 'function') {
      window.selectPersonaGlobal(PERSONAS[0].id)
    }
    return
  }
  // Pause if autoplay is running OR if any audio is actually playing (e.g., manual sound click)
  if (state.dayPlaybackState === 'playing' || isAudioPlaying()) {
    pauseDayPlayback({ keepHour: true })
    return
  }
  await startDayPlayback()
}

async function setDayAutoplayEnabled(enabled) {
  if (!state.persona) return
  state.autoplayEnabled = Boolean(enabled)
  if (!state.autoplayEnabled) {
    clearDayPlaybackTimer()
  } else if (state.dayPlaybackState === 'playing') {
    scheduleNextDayStep()
  }
  updateDayTransportUI()
}

async function jumpToHourManual(hour) {
  if (!state.persona) return
  const shouldPlayAudio = state.dayPlaybackState === 'playing'
  updateHour(hour, { playAudio: shouldPlayAudio })
  if (state.dayPlaybackState === 'playing' && state.autoplayEnabled) scheduleNextDayStep()
}

function manualSoundOverride(type, db, borough) {
  if (!state.persona) return
  const entry = state.persona.schedule[state.hour]
  const resolvedBorough = borough ?? entry?.borough
  const resolvedDb = Number.isFinite(db) ? db : getSoundsForHour(state.persona, entry?.borough, state.hour).db
  // Remember this selection so spacebar resume replays it, not the default
  state.manualSoundSelection = { type, db: resolvedDb, borough: resolvedBorough, hour: state.hour }
  if (state.dogModeActive) {
    const dogColor = getDogModeColor()
    setPlayingColor(dogColor)
    document.querySelectorAll('.sound-row').forEach(r => {
      const isThis = r.dataset.sound === type
      r.classList.toggle('playing', isThis)
      r.style.removeProperty('--accent-color')
    })
    setWaveformActive(false, dogColor)
    animateDbMeter(0, { forceColor: dogColor })
  } else {
    playSound(type, resolvedDb, resolvedBorough)
    if (state.dayPlaybackState === 'playing' && state.autoplayEnabled) scheduleNextDayStep()
  }
}

function syncAccentColor(color) {
  const next = state.dogModeActive ? getDogModeColor() : (color || state.persona?.color || '')
  state.lastSoundColor = next
  setPlayingColor(next)
  return next
}

function syncCurrentHourVisualAccent(color, db) {
  if (!state.persona) return

  const accent = syncAccentColor(color)

  if (!state.dogModeActive) {
    const currentArc = document.querySelector(`#clock-svg path[data-hour="${state.hour}"]`)
    if (currentArc && accent) currentArc.setAttribute('fill', accent)

    const currentTitle = document.querySelector('#clock-time-bar .clock-time-main')
    if (currentTitle && accent) currentTitle.style.color = accent

    const currentCell = document.querySelector(`#timeline-strip .timeline-hour-cell[data-hour="${state.hour}"]`)
    if (currentCell && accent) {
      currentCell.style.background = accent
      currentCell.style.opacity = '0.95'
    }

    updateNeighborhoodMap(state.persona, state.hour, state.startHour)
  }
  animateDbMeter(db, { forceColor: accent })
}

function getTheme() {
  return document.documentElement.dataset.theme || 'light'
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (e) {}
  const btn = document.getElementById('theme-toggle')
  if (btn) {
    const isDark = theme === 'dark'
    btn.setAttribute('aria-pressed', String(isDark))
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  }
}

function setDogModeToggleIcon() {
  const img = document.getElementById('dog-mode-enter-icon')
  if (!img) return
  img.src = 'assets/dog-mode-toggle-dark.svg'
}

function maybeRevealDogModeButton() {
  const enterBtn = document.getElementById('dog-mode-enter')
  if (!enterBtn) return
  if ((state.dogMode?.personaClicks || 0) < 3) return
  if (enterBtn.classList.contains('visible')) return

  enterBtn.classList.add('visible')
  enterBtn.classList.remove('jump-in')
  void enterBtn.offsetWidth
  enterBtn.classList.add('jump-in')
  window.setTimeout(() => enterBtn.classList.remove('jump-in'), 500)
}

function setDogModeActive(active) {
  state.dogModeActive = Boolean(active)
  document.body.classList.toggle('dog-mode', state.dogModeActive)

  const enterBtn = document.getElementById('dog-mode-enter')
  const exitBtn = document.getElementById('dog-mode-exit')
  if (exitBtn) exitBtn.hidden = !state.dogModeActive
  if (enterBtn) {
    enterBtn.title = state.dogModeActive ? 'Exit Woof Mode' : 'Dog Mode'
    enterBtn.setAttribute('aria-label', state.dogModeActive ? 'Exit Woof Mode' : 'Enter Dog Mode')
  }

  const clockSvg = document.getElementById('clock-svg')
  const dogStage = document.getElementById('dog-stage')
  // SVG elements don't support the .hidden property; use the hidden attribute.
  if (clockSvg) clockSvg.toggleAttribute('hidden', state.dogModeActive)
  if (dogStage) dogStage.hidden = !state.dogModeActive

  const tooltip = document.getElementById('hour-tooltip')
  if (tooltip) tooltip.hidden = state.dogModeActive

  setJourneyVisible(!state.dogModeActive)

  if (state.dogModeActive) {
    applyDogModeTextOverrides()
    const dogColor = getDogModeColor()
    setPlayingColor(dogColor)
    state.lastSoundColor = dogColor
    renderDogLegend()
    renderDogSoundsList({ tiles: 4 })
    renderDogRing({ persona: state.persona, selectedHour: state.hour, hourlyStats: state.hourlyStats })
  }

  if (!state.dogModeActive) {
    clearDogModeTextOverrides()
  }

  updateDayTransportUI()
}

async function enterDogMode() {
  if (state.dogModeActive) return
  if (!window.confirm('Enter Woof Mode... At Your Peril...')) return

  // Save current playback state before pausing
  state.dogMode.previousPlaybackState = state.dayPlaybackState
  pauseDayPlayback({ keepHour: true })
  resetNeighborhoodMap()
  setDogModeActive(true)
  setJourneyVisible(false)
  await startDogMode()
}

async function exitDogMode() {
  if (!state.dogModeActive) return
  stopDogMode()
  setDogModeActive(false)
  setJourneyVisible(true)

  if (state.persona) {
    drawClock(state.persona, state.hour, state.hourlyStats)
    updateHour(state.hour, { playAudio: false })
    
    // Resume playback if it was playing before entering Dog Mode
    if (state.dogMode.previousPlaybackState === 'playing') {
      await startDayPlayback()
    }
  }
  updateDayTransportUI()
}

function pulseThemeButton() {
  const btn = document.getElementById('theme-toggle')
  if (!btn) return
  btn.classList.remove('is-toggling')
  void btn.offsetWidth
  btn.classList.add('is-toggling')
  window.setTimeout(() => btn.classList.remove('is-toggling'), 500)
}

function getThemeTransitionOverlay() {
  return document.getElementById('theme-transition-overlay')
}

function openAboutModal() {
  const modal = document.getElementById('about-modal')
  if (!modal) return
  modal.hidden = false
  modal.setAttribute('aria-hidden', 'false')
  document.body.classList.add('about-modal-open')
  document.getElementById('about-modal-close')?.focus()
}

function closeAboutModal() {
  const modal = document.getElementById('about-modal')
  if (!modal) return
  modal.hidden = true
  modal.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('about-modal-open')
}

function toggleTheme() {
  if (themeTransitionLock) return
  themeTransitionLock = true
  const nextTheme = getTheme() === 'dark' ? 'light' : 'dark'
  const overlay = getThemeTransitionOverlay()
  const currentBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f7f6f2'

  if (overlay) {
    overlay.style.background = currentBg
    overlay.classList.add('is-active')
  }

  window.setTimeout(() => {
    setTheme(nextTheme)
    pulseThemeButton()
    refreshThemeVisuals()
  }, 170)

  window.setTimeout(() => {
    if (overlay) overlay.classList.remove('is-active')
    themeTransitionLock = false
  }, 360)
}

function refreshThemeVisuals() {
  refreshNeighborhoodMapTheme()
  if (!state.dogModeActive) drawClock(state.persona, state.hour, state.hourlyStats)
  if (state.persona) {
    updateNeighborhoodMap(state.persona, state.hour, state.startHour)
    if (state.dogModeActive) renderDogSoundsList({ tiles: 4 })
    else renderSoundsList(...getSoundsForHourArgs())
  }
  if (state.dogModeActive) renderDogLegend()
  else renderLegend()
  drawWaveform(analyserNode)
}

function getSoundsForHourArgs() {
  if (!state.persona) return [[], 0, false]
  const data = state.persona.schedule[state.hour]
  const { sounds, db, noData } = getSoundsForHour(state.persona, data.borough, state.hour)
  return [sounds, db, noData]
}

async function init() {
  initNeighborhoodMap()
  console.log('%c NYC never sleeps. Neither does this data. ', 'background:#070810;color:#a29bfe;font-family:monospace;padding:4px 8px')

  await loadClipIndex()
  getAudioCtx()
  state.analyserNode = analyserNode

  onPlaybackStateChange((isPlaying) => {
    const btn = document.getElementById('day-transport-btn')
    if (isPlaying) {
      // Audio started playing (e.g., from clicking sound in bottom right)
      if (btn) btn.textContent = '⏸ Pause'
      return
    }
    // Audio stopped
    if (btn) btn.textContent = state.dayPlaybackState === 'playing' ? '⏸ Pause' : '▶ Play'
    if (state.dayPlaybackState === 'playing' && state.autoplayEnabled) return
    animateDbMeter(0, { forceColor: state.lastSoundColor || '#888884' })
    setWaveformActive(false, state.lastSoundColor || undefined)
  })

  try {
    const res = await fetch('data/processed/hourly-stats.json')
    state.hourlyStats = await res.json()
  } catch (e) {
    console.warn('hourly-stats not loaded')
  }

  renderLegend()
  renderPersonas((id) => selectPersona(id, { fromUser: true }))
  renderTimeline()

  resizeWaveform()
  requestAnimationFrame(resizeWaveform)  // re-measure after layout settles
  window.addEventListener('resize', resizeWaveform)

  document.getElementById('vol-slider')?.addEventListener('input', e => {
    setMasterVolume(parseFloat(e.target.value))
  })

  document.getElementById('day-transport-btn')?.addEventListener('click', () => {
    toggleDayPlayback().catch(err => console.warn('day transport failed', err))
  })

  document.getElementById('autoplay-toggle')?.addEventListener('change', (e) => {
    const enabled = Boolean(e.target?.checked)
    setDayAutoplayEnabled(enabled).catch(err => console.warn('autoplay toggle failed', err))
  })

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme()
  })

  document.getElementById('dog-mode-enter')?.addEventListener('click', () => {
    if (state.dogModeActive) {
      exitDogMode()
      return
    }
    enterDogMode().catch(err => console.warn('enter dog mode failed', err))
  })

  document.getElementById('dog-mode-exit')?.addEventListener('click', () => {
    exitDogMode()
  })

  document.getElementById('about-btn')?.addEventListener('click', () => {
    openAboutModal()
  })

  document.getElementById('about-modal-close')?.addEventListener('click', () => {
    closeAboutModal()
  })

  document.getElementById('about-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'about-modal') closeAboutModal()
  })

  document.getElementById('journey-desc-text')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-hour]')
    if (!target) return
    const hour = Number.parseInt(target.dataset.hour, 10)
    if (Number.isNaN(hour) || !state.persona) return
    jumpToHourManual(hour)
      .then(() => {
        // snap transcript view so the new current hour is immediately visible
        const overlay = document.getElementById('story-overlay')
        if (overlay) overlay.scrollTop = 0
        document.querySelector('#story-overlay .story-history')?.scrollTo({ top: 0 })
      })
      .catch(err => console.warn('manual jump failed', err))
  })

  updateDayTransportUI()
  setTheme(getTheme())
  setDogModeToggleIcon()

  document.addEventListener('keydown', e => {
    const isSpaceKey = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar'
    if (!isSpaceKey) return
    const target = e.target
    const isFormField = target instanceof HTMLElement && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )
    if (isFormField) return
    e.preventDefault()
    e.stopPropagation()
    if (e.repeat) return
    if (!state.persona) return
    if (state.dogModeActive) return
    toggleDayPlayback().catch(err => console.warn('day transport failed', err))
  }, true)

  document.addEventListener('keyup', e => {
    const isSpaceKey = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar'
    if (!isSpaceKey) return
    const target = e.target
    const isFormField = target instanceof HTMLElement && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )
    if (isFormField) return
    e.preventDefault()
    e.stopPropagation()
  }, true)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAboutModal()
      return
    }

    const target = e.target
    const isAutoplayInput = target instanceof HTMLElement && target.id === 'autoplay-toggle'
    const isFormField = target instanceof HTMLElement && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )

    if (e.key === 'ArrowRight' && state.persona) {
      if (isFormField && !isAutoplayInput) return
      e.preventDefault()
      jumpToHourManual((state.hour + 1) % 24).catch(err => console.warn('manual jump failed', err))
    } else if (e.key === 'ArrowLeft' && state.persona) {
      if (isFormField && !isAutoplayInput) return
      e.preventDefault()
      jumpToHourManual((state.hour + 23) % 24).catch(err => console.warn('manual jump failed', err))
    } else if (e.key === 'ArrowUp') {
      if (isFormField && !isAutoplayInput) return
      e.preventDefault()
      cyclePersona(-1)
    } else if (e.key === 'ArrowDown') {
      if (isFormField && !isAutoplayInput) return
      e.preventDefault()
      cyclePersona(1)
    }
  })

  updateHour(0)
}

// plays a sound and updates the UI playing state + color
function playSound(type, db, borough) {
  if (state.dogModeActive) return
  const color = getSoundColor(type) || state.persona?.color || ''
  const clipKey = `${state.persona?.id || 'none'}:${state.hour}:${borough || 'x'}:${type}`
  const fullLength = !state.autoplayEnabled
  const currentEntry = state.persona?.schedule?.[state.hour]
  const lat = Number.isFinite(currentEntry?.lat) ? currentEntry.lat : null
  const lng = Number.isFinite(currentEntry?.lng) ? currentEntry.lng : null
  syncCurrentHourVisualAccent(color, db)
  setWaveformActive(type !== 'flatline', color)
  document.querySelectorAll('.sound-row').forEach(r => {
    const isThis = r.dataset.sound === type
    r.classList.toggle('playing', isThis)
    if (isThis && color) r.style.setProperty('--accent-color', color)
  })
    playSoundType(type, db, borough, clipKey, { fullLength, hour: state.hour, lat, lng })
}

// derive top sounds + db from actual SONYC data for this borough+hour
function getSoundsForHour(persona, borough, hour) {
  if (!state.hourlyStats) return { sounds: [], db: 75, noData: false, prevalence: {} }
  const boroughData = state.hourlyStats.by_borough[String(borough)]
  if (!boroughData) return { sounds: [], db: 75, noData: true, prevalence: {} }
  const hourData = boroughData[String(hour)]
  if (!hourData) return { sounds: [], db: 35, noData: true, prevalence: {} }
  const sounds = rankSounds(
    Object.entries(hourData.prevalence)
      .filter(([, v]) => v >= MIN_SOUND_PREVALENCE)
      .map(([k]) => k),
    hourData.prevalence,
    persona
  ).slice(0, 4)
  return { sounds, db: hourData.db, noData: false, prevalence: hourData.prevalence }
}

// pick dominant sound: thresholds first, then priority, then prevalence fallback
function pickFeatureSound(sounds, prevalence, persona) {
  return pickVisualSound(sounds, prevalence, persona, state.hour)
}

function cyclePersona(step) {
  if (!PERSONAS.length) return
  const currentIdx = PERSONAS.findIndex(p => p.id === state.persona?.id)
  if (currentIdx < 0) {
    const fallback = step >= 0 ? 0 : PERSONAS.length - 1
    selectPersona(PERSONAS[fallback].id, { fromUser: true })
    return
  }
  const nextIdx = (currentIdx + step + PERSONAS.length) % PERSONAS.length
  selectPersona(PERSONAS[nextIdx].id, { fromUser: true })
}

function selectPersona(id, options = {}) {
  if (options.fromUser) {
    state.dogMode.personaClicks = (state.dogMode.personaClicks || 0) + 1
    maybeRevealDogModeButton()
  }

  if (state.persona?.id === id) {
    toggleDayPlayback().catch(err => console.warn('day transport failed', err))
    return
  }

  state.persona = PERSONAS.find(p => p.id === id)
  if (!state.persona) return

  pauseDayPlayback({ keepHour: false })

  // Clear any manually selected sound from previous persona
  state.manualSoundSelection = null

  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'))
  document.getElementById(`persona-${id}`).classList.add('active')

  // reset dB so it counts up from 0 on select
  document.getElementById('db-value').textContent = '0'

  // brief flash of persona color on left panel border
  const leftPanel = document.querySelector('.panel-left')
  leftPanel.style.setProperty('--accent', state.persona.color)
  leftPanel.classList.remove('panel-flash')
  void leftPanel.offsetWidth
  leftPanel.classList.add('panel-flash')

  state.storyLog = []
  // Pre-compute all 24 hours' stories for carousel-like behavior
  state.allStories = {}
  for (let h = 0; h < 24; h++) {
    const data = state.persona.schedule[h]
    const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
    const suffix = h < 12 ? 'AM' : 'PM'
    state.allStories[h] = { h, displayH, suffix, desc: data.desc }
  }
  
  resetNeighborhoodMap()
  setWaveformActive(false)
  animateDbMeter(0)

  const startHour = 8
  state.hour = startHour
  state.startHour = startHour
  if (!state.dogModeActive) {
    drawClock(state.persona, startHour, state.hourlyStats)
  } else {
    renderDogRing({ persona: state.persona, selectedHour: startHour, hourlyStats: state.hourlyStats })
  }
  updateHour(startHour, { playAudio: false })
  renderTimeline(state.persona, state.hourlyStats)
  updateDayTransportUI()

  if (!state.dogModeActive) {
    startDayPlayback().catch(err => console.warn('autoplay start failed', err))
  }
}

function updateHour(h, options = {}) {
  if (!state.persona) return
  const shouldPlayAudio = !state.dogModeActive && options.playAudio !== false && state.dayPlaybackState === 'playing'

  // Clear manual sound selection when changing hours
  if (h !== state.hour) {
    state.manualSoundSelection = null
  }

  state.hour = h
  const data = state.persona.schedule[h]
  const { sounds, db, noData, prevalence } = getSoundsForHour(state.persona, data.borough, h)
  const override = state.persona.soundOverrides?.[h]
  const feature = noData ? null : (override || pickFeatureSound(sounds, prevalence, state.persona))
  // pre-assignment type corrects mislabeled SONYC clips, but soundOverride always wins
  const assignKey = `${state.persona.id}:${h}`
  const effectiveFeature = override ? feature : (feature && clipAssignments[assignKey]?.type ? clipAssignments[assignKey].type : feature)
  const featureColor = effectiveFeature ? getSoundColor(effectiveFeature) : state.persona.color
  const displaySounds = effectiveFeature
    ? [effectiveFeature, ...sounds.filter(s => s !== effectiveFeature)].slice(0, 4)
    : sounds

  const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
  const suffix = h < 12 ? 'AM' : 'PM'

  document.getElementById('journey-hour-text').textContent = `${displayH}:00 ${suffix}`
  document.getElementById('journey-location-text').textContent = data.loc
  document.getElementById('journey-info').style.setProperty('--persona-color', state.persona.color)

  const timeMain = document.getElementById('clock-time-main')
  if (timeMain) {
    timeMain.textContent = state.dogModeActive ? 'Woof' : `${displayH}:00 ${suffix}`
    timeMain.style.color = state.dogModeActive ? getDogModeColor() : featureColor
  }
  const timeSub = document.getElementById('clock-time-sub')
  if (timeSub) timeSub.textContent = state.dogModeActive ? 'Woof' : data.loc

  if (!state.dogModeActive) renderStory(h, state.allStories)

  syncCurrentHourVisualAccent(featureColor, db)

  if (state.dogModeActive) renderDogSoundsList()
  else renderSoundsList(displaySounds, db, noData)
  updateTimeline(h)

  if (!state.dogModeActive) updateClockHour(h)
  else renderDogRing({ persona: state.persona, selectedHour: h, hourlyStats: state.hourlyStats })
  drawWaveform(analyserNode)

  // warm buffer cache for next hour so the 5s autoplay timer never races a cold fetch
  const nextH = (h + 1) % 24
  const nextUrl = clipAssignments[`${state.persona.id}:${nextH}`]?.url
  if (nextUrl) prefetchClip(nextUrl)

  if (shouldPlayAudio) {
    if (noData) {
      playSound('flatline', db, data.borough)
    } else {
      if (effectiveFeature) playSound(effectiveFeature, db, data.borough)
    }
  } else {
    animateDbMeter(0, { forceColor: state.lastSoundColor || featureColor })
    setWaveformActive(false, state.lastSoundColor || featureColor)
  }

  updateDayTransportUI()
}

init()
