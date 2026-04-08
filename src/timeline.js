import { getSoundColor } from './personas.js'
import { pickVisualSound, MIN_SOUND_PREVALENCE } from './clock.js'
import { clipAssignments } from './audio.js'

export function renderTimeline(persona, hourlyStats) {
  const el = document.getElementById('timeline-strip')
  if (!persona) {
    el.innerHTML = Array(24).fill(0).map(() =>
      `<div class="timeline-hour-cell" style="background:#e4e3de"></div>`
    ).join('')
    return
  }

  el.innerHTML = persona.schedule.map((data, h) => {
    let color = '#ccc9c1'
    let opacity = 0.5
    if (hourlyStats) {
      const hData = hourlyStats.by_borough?.[String(data.borough)]?.[String(h)]
      if (hData) {
        const sounds = Object.entries(hData.prevalence)
          .filter(([, v]) => v >= MIN_SOUND_PREVALENCE)
          .map(([k]) => k)
        const assignedType = clipAssignments[`${persona.id}:${h}`]?.type
        const top = assignedType || pickVisualSound(sounds, hData.prevalence, persona, h)
        if (top) {
          color = getSoundColor(top) || '#e4e3de'
          opacity = 0.85
        }
      }
    }
    const hLabel = h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`
    return `<div class="timeline-hour-cell" data-hour="${h}" style="background:${color};opacity:${opacity}" aria-label="${hLabel}" role="button" tabindex="0"></div>`
  }).join('')

  document.querySelectorAll('.timeline-hour-cell').forEach(cell => {
    const h = parseInt(cell.dataset.hour)
    cell.addEventListener('click', () => window.updateHourGlobal?.(h))
    cell.addEventListener('keydown', e => {
      if (e.key === ' ') { e.preventDefault(); window.updateHourGlobal?.(h) }
    })
  })
}

export function updateTimeline(hour) {
  document.querySelectorAll('.timeline-hour-cell').forEach(c => c.classList.remove('current'))
  const cell = document.querySelector(`.timeline-hour-cell[data-hour="${hour}"]`)
  if (cell) cell.classList.add('current')
}
