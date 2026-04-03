import { state } from './state.js'
import { PERSONAS, SOUND_COLORS } from './personas.js'
import { drawClock } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, renderStory, animateDbMeter, setPlayingColor } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx, loadClipIndex, setMasterVolume } from './audio.js'
import { resizeWaveform, drawWaveform, setWaveformActive } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'
import { initNeighborhoodMap, updateNeighborhoodMap, resetNeighborhoodMap } from './neighborhoodmap.js'

window.updateHourGlobal = updateHour
window.selectPersonaGlobal = selectPersona

// wrapper so clicking a sound row also updates playing state + color
window.playSoundGlobal = (type, db, borough) => {
  playSound(type, db, borough)
}

async function init() {
  initNeighborhoodMap()
  console.log('%c NYC never sleeps. Neither does this data. ', 'background:#070810;color:#a29bfe;font-family:monospace;padding:4px 8px')

  loadClipIndex()
  getAudioCtx()
  state.analyserNode = analyserNode

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
  const color = SOUND_COLORS[type] || state.persona?.color || ''
  setPlayingColor(color)
  setWaveformActive(type !== 'flatline', color)
  document.querySelectorAll('.sound-row').forEach(r => {
    const isThis = r.dataset.sound === type
    r.classList.toggle('playing', isThis)
    if (isThis && color) r.style.setProperty('--accent-color', color)
  })
  playSoundType(type, db, borough)
}

// how sonically interesting each type is — weights the audio pick toward unusual sounds
const SOUND_INTEREST = { saw: 4, machinery: 3, dog: 2.5, music: 2, alert: 1.5, impact: 1.2, voice: 0.6, engine: 0.4 }

// derive top sounds + db from actual SONYC data for this borough+hour
function getSoundsForHour(borough, hour) {
  if (!state.hourlyStats) return { sounds: [], db: 75, noData: false, prevalence: {} }
  const boroughData = state.hourlyStats.by_borough[String(borough)]
  if (!boroughData) return { sounds: [], db: 75, noData: true, prevalence: {} }
  const hourData = boroughData[String(hour)]
  if (!hourData) return { sounds: [], db: 35, noData: true, prevalence: {} }
  const sounds = Object.entries(hourData.prevalence)
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 4)
  return { sounds, db: hourData.db, noData: false, prevalence: hourData.prevalence }
}

// pick the most interesting sound to play — weighted by prevalence × interest score
function pickFeatureSound(sounds, prevalence) {
  if (!sounds.length) return null
  return sounds.slice().sort((a, b) =>
    (prevalence[b] || 0) * (SOUND_INTEREST[b] || 1) - (prevalence[a] || 0) * (SOUND_INTEREST[a] || 1)
  )[0]
}

function selectPersona(id) {
  state.persona = PERSONAS.find(p => p.id === id)
  if (!state.persona) return

  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'))
  document.getElementById(`persona-${id}`).classList.add('active')
  const statusEl = document.getElementById('status-persona')
  if (statusEl) statusEl.textContent = `${state.persona.name} · ${state.persona.role} · ${state.persona.home}`

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
  updateHour(0)
  renderTimeline(state.persona, state.hourlyStats)
}

function updateHour(h) {
  if (!state.persona) return

  state.hour = h
  const data = state.persona.schedule[h]
  const { sounds, db, noData, prevalence } = getSoundsForHour(data.borough, h)

  const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
  const suffix = h < 12 ? 'AM' : 'PM'

  document.getElementById('journey-hour-text').textContent = `${displayH}:00 ${suffix}`
  document.getElementById('journey-location-text').textContent = data.loc
  document.getElementById('journey-info').style.setProperty('--persona-color', state.persona.color)

  const bar = document.getElementById('clock-time-bar')
  if (bar) {
    bar.style.color = state.persona.color
    bar.textContent = `${displayH}:00 ${suffix}  ·  ${data.loc}`
  }

  // accumulate story entries as user scrubs through the day
  const alreadyLogged = state.storyLog.some(e => e.h === h)
  if (data.desc && !alreadyLogged) {
    state.storyLog.push({ h, displayH, suffix, desc: data.desc })
    renderStory(state.storyLog)
  }

  updateNeighborhoodMap(state.persona, h)

  renderSoundsList(sounds, db, noData)
  animateDbMeter(db)
  updateTimeline(h)

  drawClock(state.persona, h, state.hourlyStats)
  drawWaveform(analyserNode)

  if (noData) {
    playSound('flatline', db, data.borough)
  } else {
    const feature = pickFeatureSound(sounds, prevalence)
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
