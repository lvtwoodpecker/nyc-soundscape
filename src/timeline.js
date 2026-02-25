export function renderTimeline(persona) {
  const el = document.getElementById('timeline-strip')
  if (!persona) {
    el.innerHTML = Array(24).fill(0).map((_, h) =>
      `<div class="timeline-hour-cell" style="background:#13162a"></div>`
    ).join('')
    return
  }

  el.innerHTML = persona.schedule.map((data, h) => {
    const dominantSound = data.sounds[0] || ''
    const hasData = data.sounds.length > 0
    const color = hasData ? `var(--c-${dominantSound})` : '#13162a'
    return `<div class="timeline-hour-cell" data-hour="${h}" style="background:${color};opacity:${hasData ? 0.7 : 0.3}"></div>`
  }).join('')

  document.querySelectorAll('.timeline-hour-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
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
