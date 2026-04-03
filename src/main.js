import { state } from './state.js'
import { PERSONAS, getSoundColor } from './personas.js'
import { drawClock, updateClockHour, pickVisualSound, rankSounds, MIN_SOUND_PREVALENCE } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, renderStory, animateDbMeter, setPlayingColor } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx, loadClipIndex, setMasterVolume, pauseAudio, resumeAudio, isAudioPaused, onPlaybackStateChange } from './audio.js'
import { resizeWaveform, drawWaveform, setWaveformActive } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'
import { initNeighborhoodMap, updateNeighborhoodMap, resetNeighborhoodMap, refreshNeighborhoodMapTheme } from './neighborhoodmap.js'

const THEME_KEY = 'nyc-soundscape-theme'
let themeTransitionLock = false

window.updateHourGlobal = updateHour
window.selectPersonaGlobal = selectPersona

// wrapper so clicking a sound row also updates playing state + color
window.playSoundGlobal = (type, db, borough) => {
  playSound(type, db, borough)
}

function getPausedDbColor() {
  return state.lastSoundColor || '#888884'
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

  updateNeighborhoodMap(state.persona, state.hour)
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

function toggleOnboarding() {
  document.getElementById('onboarding-state')?.classList.toggle('hidden')
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
    updateNeighborhoodMap(state.persona, state.hour)
    renderSoundsList(...getSoundsForHourArgs())
  }
  renderLegend()
  drawWaveform(analyserNode)
  if (state.isSoundPaused) {
    setPausedDbState()
  }
}

function getSoundsForHourArgs() {
  if (!state.persona) return [[], 0, false]
  const data = state.persona.schedule[state.hour]
  const { sounds, db, noData } = getSoundsForHour(state.persona, data.borough, state.hour)
  return [sounds, db, noData]
}

function setPausedDbState() {
  animateDbMeter(0, { forceColor: getPausedDbColor() })
}

function updatePauseButton() {
  const btn = document.getElementById('pause-sound-btn')
  if (!btn) return
  if (state.isSoundPaused) {
    btn.textContent = '▶ Resume Sound'
    btn.classList.add('active')
  } else {
    btn.textContent = '⏸ Pause Sound'
    btn.classList.remove('active')
  }
}

async function toggleSoundPause() {
  if (isAudioPaused() || state.isSoundPaused) {
    await resumeAudio()
    state.isSoundPaused = false
    updatePauseButton()
    updateHour(state.hour)
    return
  }

  await pauseAudio()
  state.isSoundPaused = true
  updatePauseButton()
  setWaveformActive(false, state.lastSoundColor || undefined)
  setPausedDbState()
}

async function init() {
  initNeighborhoodMap()
  console.log('%c NYC never sleeps. Neither does this data. ', 'background:#070810;color:#a29bfe;font-family:monospace;padding:4px 8px')

  loadClipIndex()
  getAudioCtx()
  state.analyserNode = analyserNode

  onPlaybackStateChange((isPlaying) => {
    if (isPlaying || state.isSoundPaused) return
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

  document.getElementById('pause-sound-btn')?.addEventListener('click', () => {
    toggleSoundPause().catch(err => console.warn('pause toggle failed', err))
  })

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme()
  })

  document.getElementById('about-btn')?.addEventListener('click', () => {
    toggleOnboarding()
  })

  document.getElementById('journey-desc-text')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-hour]')
    if (!target) return
    const hour = Number.parseInt(target.dataset.hour, 10)
    if (Number.isNaN(hour) || !state.persona) return
    updateHour(hour)
  })

  document.getElementById('journey-desc-text')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const target = e.target.closest('[data-hour]')
    if (!target) return
    e.preventDefault()
    const hour = Number.parseInt(target.dataset.hour, 10)
    if (Number.isNaN(hour) || !state.persona) return
    updateHour(hour)
  })

  updatePauseButton()
  setTheme(getTheme())

  document.addEventListener('keydown', e => {
    // ignore when typing in an input
    if (e.target.tagName === 'INPUT') return
    if (e.key === ' ') {
      e.preventDefault()
      toggleAutoPlay()
    } else if (e.key === 'ArrowRight' && state.persona) {
      e.preventDefault()
      if (state.isAutoPlaying) return
      updateHour((state.hour + 1) % 24)
    } else if (e.key === 'ArrowLeft' && state.persona) {
      e.preventDefault()
      if (state.isAutoPlaying) return
      updateHour((state.hour + 23) % 24)
    }
  })

  updateHour(0)
}

// plays a sound and updates the UI playing state + color
function playSound(type, db, borough) {
  const color = getSoundColor(type) || state.persona?.color || ''
  syncCurrentHourVisualAccent(color, db)
  setWaveformActive(type !== 'flatline', color)
  document.querySelectorAll('.sound-row').forEach(r => {
    const isThis = r.dataset.sound === type
    r.classList.toggle('playing', isThis)
    if (isThis && color) r.style.setProperty('--accent-color', color)
  })
  playSoundType(type, db, borough)
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
  state.persona = PERSONAS.find(p => p.id === id)
  if (!state.persona) return

  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'))
  document.getElementById(`persona-${id}`).classList.add('active')
  const statusEl = document.getElementById('status-persona')
  if (statusEl) statusEl.textContent = `${state.persona.name} · ${state.persona.role} · ${state.persona.home}`

  document.getElementById('play-btn').disabled = false
  document.getElementById('pause-sound-btn').disabled = false
  document.getElementById('onboarding-state')?.classList.add('hidden')

  // reset dB so it counts up from 0 on select
  document.getElementById('db-value').textContent = '0'

  // brief flash of persona color on left panel border
  const leftPanel = document.querySelector('.panel-left')
  leftPanel.style.setProperty('--accent', state.persona.color)
  leftPanel.classList.remove('panel-flash')
  void leftPanel.offsetWidth
  leftPanel.classList.add('panel-flash')

  state.storyLog = []
  resetNeighborhoodMap()
  setWaveformActive(false)
  animateDbMeter(0)

  state.hour = 0
  drawClock(state.persona, 0, state.hourlyStats)
  updateHour(0)
  renderTimeline(state.persona, state.hourlyStats)
}

function updateHour(h) {
  if (!state.persona) return

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

  const bar = document.getElementById('clock-time-bar')
  if (bar) {
    bar.innerHTML = `
      <div class="clock-time-main" style="color:${featureColor}">${displayH}:00 ${suffix}</div>
      <div class="clock-time-sub">${data.loc}</div>
    `
  }

  // accumulate story entries as user scrubs through the day
  const alreadyLogged = state.storyLog.some(e => e.h === h)
  if (data.desc && !alreadyLogged) {
    state.storyLog.push({ h, displayH, suffix, desc: data.desc })
    renderStory(state.storyLog)
  }

  syncCurrentHourVisualAccent(featureColor, db)

  renderSoundsList(displaySounds, db, noData)
  if (state.isSoundPaused) {
    setPausedDbState()
  }
  updateTimeline(h)

  updateClockHour(h)
  drawWaveform(analyserNode)

  if (state.isSoundPaused) {
    setWaveformActive(false, state.lastSoundColor || undefined)
    return
  }

  if (noData) {
    playSound('flatline', db, data.borough)
  } else {
    if (feature) playSound(feature, db, data.borough)
  }
}

function toggleAutoPlay() {
  const btn = document.getElementById('play-btn')
  if (state.isAutoPlaying) {
    state.isAutoPlaying = false
    clearInterval(state.autoPlayInterval)
    btn.classList.remove('active')
    btn.textContent = '▶ Play the Day'
    setWaveformActive(false)
    animateDbMeter(0)
    return
  }

  if (!state.persona) return

  state.isAutoPlaying = true
  btn.classList.add('active')
  btn.textContent = '⏸'

  updateHour(0)
  let h = 0
  state.autoPlayInterval = setInterval(() => {
    h = (h + 1) % 24
    updateHour(h)
    if (h === 23) {
      state.isAutoPlaying = false
      clearInterval(state.autoPlayInterval)
      btn.classList.remove('active')
      btn.textContent = '▶ Play the Day'
      setWaveformActive(false)
      animateDbMeter(0)
    }
  }, 3000)
}

document.getElementById('play-btn')?.addEventListener('click', toggleAutoPlay)

init()
