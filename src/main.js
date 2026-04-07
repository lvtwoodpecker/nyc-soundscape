import { state } from './state.js'
import { PERSONAS, getSoundColor } from './personas.js'
import { drawClock, updateClockHour, pickVisualSound, rankSounds, MIN_SOUND_PREVALENCE } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, renderStory, animateDbMeter, setPlayingColor } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx, loadClipIndex, setMasterVolume, stopAllSounds, onPlaybackStateChange, isAudioPlaying } from './audio.js'
import { resizeWaveform, drawWaveform, setWaveformActive } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'
import { initNeighborhoodMap, updateNeighborhoodMap, resetNeighborhoodMap, refreshNeighborhoodMapTheme } from './neighborhoodmap.js'

const THEME_KEY = 'nyc-soundscape-theme'
let themeTransitionLock = false
const DAY_STEP_MS = 5000

window.updateHourGlobal = (h) => {
  jumpToHourManual(h).catch(err => console.warn('manual jump failed', err))
}
window.selectPersonaGlobal = selectPersona

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

  if (btn) {
    btn.disabled = !hasPersona
    btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play'
    btn.setAttribute('aria-pressed', String(isPlaying))
  }

  if (autoplayWrap) autoplayWrap.hidden = !hasPersona

  if (autoplayToggle) {
    autoplayToggle.disabled = !hasPersona
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
  if (!state.persona) return
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
  playSound(type, resolvedDb, resolvedBorough)
  if (state.dayPlaybackState === 'playing' && state.autoplayEnabled) scheduleNextDayStep()
}

function syncAccentColor(color) {
  const next = color || state.persona?.color || ''
  state.lastSoundColor = next
  setPlayingColor(next)
  return next
}

function syncCurrentHourVisualAccent(color, db) {
  if (!state.persona) return

  const accent = syncAccentColor(color)

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
  drawClock(state.persona, state.hour, state.hourlyStats)
  if (state.persona) {
    updateNeighborhoodMap(state.persona, state.hour, state.startHour)
    renderSoundsList(...getSoundsForHourArgs())
  }
  renderLegend()
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

  loadClipIndex()
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
  renderPersonas(selectPersona)
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

  document.addEventListener('keydown', e => {
    if (e.key !== ' ') return
    // let persona cards handle their own space (selection)
    if (document.activeElement?.classList.contains('persona-card')) return
    e.preventDefault()
    e.stopPropagation()
    if (e.repeat) return
    if (!state.persona) return
    toggleDayPlayback().catch(err => console.warn('day transport failed', err))
  }, true)

  document.addEventListener('keyup', e => {
    if (e.key !== ' ') return
    if (document.activeElement?.classList.contains('persona-card')) return
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
    }
  })

  updateHour(0)
}

// plays a sound and updates the UI playing state + color
function playSound(type, db, borough) {
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

function selectPersona(id) {
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
  drawClock(state.persona, startHour, state.hourlyStats)
  updateHour(startHour, { playAudio: false })
  renderTimeline(state.persona, state.hourlyStats)
  updateDayTransportUI()

  startDayPlayback().catch(err => console.warn('autoplay start failed', err))
}

function updateHour(h, options = {}) {
  if (!state.persona) return
  const shouldPlayAudio = options.playAudio !== false && state.dayPlaybackState === 'playing'

  // Clear manual sound selection when changing hours
  if (h !== state.hour) {
    state.manualSoundSelection = null
  }

  state.hour = h
  const data = state.persona.schedule[h]
  const { sounds, db, noData, prevalence } = getSoundsForHour(state.persona, data.borough, h)
  const override = state.persona.soundOverrides?.[h]
  const feature = noData ? null : (override || pickFeatureSound(sounds, prevalence, state.persona))
  const featureColor = feature ? getSoundColor(feature) : state.persona.color
  const displaySounds = feature
    ? [feature, ...sounds.filter(s => s !== feature)].slice(0, 4)
    : sounds

  const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
  const suffix = h < 12 ? 'AM' : 'PM'

  document.getElementById('journey-hour-text').textContent = `${displayH}:00 ${suffix}`
  document.getElementById('journey-location-text').textContent = data.loc
  document.getElementById('journey-info').style.setProperty('--persona-color', state.persona.color)

  const timeMain = document.getElementById('clock-time-main')
  if (timeMain) {
    timeMain.textContent = `${displayH}:00 ${suffix}`
    timeMain.style.color = featureColor
  }
  const timeSub = document.getElementById('clock-time-sub')
  if (timeSub) timeSub.textContent = data.loc

  // render story carousel snapped to current hour
  renderStory(h, state.allStories)

  syncCurrentHourVisualAccent(featureColor, db)

  renderSoundsList(displaySounds, db, noData)
  updateTimeline(h)

  updateClockHour(h)
  drawWaveform(analyserNode)

  if (shouldPlayAudio) {
    if (noData) {
      playSound('flatline', db, data.borough)
    } else {
      if (feature) playSound(feature, db, data.borough)
    }
  } else {
    animateDbMeter(0, { forceColor: state.lastSoundColor || featureColor })
    setWaveformActive(false, state.lastSoundColor || featureColor)
  }

  updateDayTransportUI()
}

init()
