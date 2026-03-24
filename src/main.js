import { state } from './state.js'
import { PERSONAS } from './personas.js'
import { drawClock } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, animateDbMeter } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx, loadClipIndex } from './audio.js'
import { resizeWaveform, drawWaveform } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'

window.updateHourGlobal = updateHour
window.playSoundGlobal = playSoundType
window.selectPersonaGlobal = selectPersona

async function init() {
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
  window.addEventListener('resize', resizeWaveform)

  updateHour(0)
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
  document.getElementById('status-persona').textContent = 
    `${state.persona.name} · ${state.persona.role} · ${state.persona.home}`
  
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
  document.getElementById('journey-desc-text').textContent = data.desc

  renderSoundsList(sounds, db, noData)
  animateDbMeter(db)
  updateTimeline(h)

  drawClock(state.persona, h, state.hourlyStats)
  drawWaveform(analyserNode, state.persona.color)

  if (noData) {
    playSoundType('flatline', db, data.borough)
  } else {
    const feature = pickFeatureSound(sounds, prevalence)
    if (feature) playSoundType(feature, db, data.borough)
  }
}

function toggleAutoPlay() {
  const btn = document.getElementById('play-btn')
  if (state.isAutoPlaying) {
    state.isAutoPlaying = false
    clearInterval(state.autoPlayInterval)
    btn.classList.remove('active')
    btn.textContent = '▶ AUTO-PLAY DAY'
    return
  }
  
  if (!state.persona) return
  
  state.isAutoPlaying = true
  btn.classList.add('active')
  btn.textContent = '■ STOP'
  
  updateHour(0)
  let h = 0
  state.autoPlayInterval = setInterval(() => {
    h = (h + 1) % 24
    updateHour(h)
  }, 3000)
}

document.getElementById('play-btn').addEventListener('click', toggleAutoPlay)

init()
