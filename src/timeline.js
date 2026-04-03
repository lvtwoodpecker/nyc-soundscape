import { SOUND_COLORS } from './personas.js'
import { INTEREST } from './clock.js'

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
        const top = Object.entries(hData.prevalence)
          .filter(([, v]) => v >= 0.05)
          .sort((a, b) => b[1] * (INTEREST[b[0]] || 1) - a[1] * (INTEREST[a[0]] || 1))[0]
        if (top) {
          color = SOUND_COLORS[top[0]] || '#e4e3de'
          opacity = 0.85
        }
      }
    }
    return `<div class="timeline-hour-cell" data-hour="${h}" style="background:${color};opacity:${opacity}"></div>`
  }).join('')

  document.querySelectorAll('.timeline-hour-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const h = parseInt(cell.dataset.hour)
      window.updateHourGlobal?.(h)
    })
  })
}

export function updateTimeline(hour) {
  document.querySelectorAll('.timeline-hour-cell').forEach(c => c.classList.remove('current'))
  const cell = document.querySelector(`[data-hour="${hour}"]`)
  if (cell) cell.classList.add('current')
}
