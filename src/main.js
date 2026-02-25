import { state } from './state.js'
import { PERSONAS } from './personas.js'
import { drawClock } from './clock.js'
import { renderLegend, renderPersonas, renderSoundsList, animateDbMeter } from './ui.js'
import { playSoundType, analyserNode, getAudioCtx } from './audio.js'
import { resizeWaveform, drawWaveform } from './waveform.js'
import { renderTimeline, updateTimeline } from './timeline.js'

window.updateHourGlobal = updateHour
window.playSoundGlobal = playSoundType
window.selectPersonaGlobal = selectPersona

function init() {
  getAudioCtx()
  state.analyserNode = analyserNode
  
  renderLegend()
  renderPersonas(selectPersona)
  renderTimeline()
  
  resizeWaveform()
  window.addEventListener('resize', resizeWaveform)
  
  updateHour(0)
}

function selectPersona(id) {
  state.persona = PERSONAS.find(p => p.id === id)
  if (!state.persona) return
  
  document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'))
  document.getElementById(`persona-${id}`).classList.add('active')
  document.getElementById('status-persona').textContent = 
    `${state.persona.name} · ${state.persona.role} · ${state.persona.borough}`
  
  state.hour = 0
  updateHour(0)
  renderTimeline(state.persona)
}

function updateHour(h) {
  if (!state.persona) return
  
  state.hour = h
  const data = state.persona.schedule[h]
  
  const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
  const suffix = h < 12 ? 'AM' : 'PM'
  
  document.getElementById('journey-hour-text').textContent = `${displayH}:00 ${suffix}`
  document.getElementById('journey-location-text').textContent = data.loc
  document.getElementById('journey-desc-text').textContent = data.desc
  
  renderSoundsList(data.sounds, data.db, data.noData)
  animateDbMeter(data.db)
  updateTimeline(h)
  
  drawClock(state.persona, h)
  drawWaveform(analyserNode, state.persona.color)
  
  if (data.noData) {
    playSoundType('flatline', data.db)
  } else if (data.sounds.length > 0) {
    playSoundType(data.sounds[0], data.db)
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
