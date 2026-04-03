import { SOUND_COLORS, SOUND_LABELS, PERSONAS, getSoundColor } from './personas.js'

export function renderLegend() {
  const el = document.getElementById('legend')
  if (!el) return
  el.innerHTML = Object.keys(SOUND_COLORS).map(k => {
    const c = getSoundColor(k)
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${c};box-shadow:0 0 4px ${c}"></div>
      <span>${SOUND_LABELS[k] || k}</span>
    </div>`
  }).join('')
}

export function renderPersonas(onSelect) {
  const el = document.getElementById('persona-list')
  el.innerHTML = PERSONAS.map(p =>
    `<div class="persona-card" id="persona-${p.id}" style="--accent:${p.color}" role="button" tabindex="0">
      <div class="persona-name">${p.name}</div>
      <div class="persona-meta">${p.role}</div>
      <span class="persona-borough" style="color:${p.color}">${p.home}</span>
    </div>`
  ).join('')

  document.querySelectorAll('.persona-card').forEach(card => {
    const id = card.id.replace('persona-', '')
    card.addEventListener('click', () => onSelect(id))
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id) } })
  })
}

export function renderSoundsList(sounds, db, noData) {
  const el = document.getElementById('sounds-list')

  if (noData) {
    el.innerHTML = '<div class="sounds-empty">No data this hour.</div>'
    return
  }
  if (!sounds || sounds.length === 0) {
    el.innerHTML = '<div class="sounds-empty">No sounds detected this hour.</div>'
    return
  }
  el.innerHTML = sounds.map(s => `
    <button type="button" class="sound-row" data-sound="${s}">
      <div class="sound-dot" style="background:${getSoundColor(s)};color:${getSoundColor(s)}"></div>
      <div class="sound-name">${SOUND_LABELS[s] || s}</div>
    </button>
  `).join('')
  el.querySelectorAll('.sound-row').forEach(btn => {
    const type = btn.dataset.sound
    btn.addEventListener('click', () => window.playSoundGlobal?.(type, db))
  })
}

export function renderStory(log) {
  const el = document.getElementById('journey-desc-text')
  if (!el) return
  el.innerHTML = [...log].reverse().map(({ h, displayH, suffix, desc }) =>
    `<button type="button" class="story-entry" data-hour="${h}" aria-label="Seek to ${displayH}:00 ${suffix}">
      <span class="story-time">${displayH}:00 ${suffix}</span>
      <span class="story-desc">${desc}</span>
    </button>`
  ).join('')
}

export function setPlayingColor(color) {
  document.documentElement.style.setProperty('--playing-color', color || '')
}

let dbRafId = null

export function animateDbMeter(targetDb, options = {}) {
  const valueEl = document.getElementById('db-value')
  if (!valueEl) return

  if (dbRafId) cancelAnimationFrame(dbRafId)

  const forcedColor = options.forceColor || ''
  if (forcedColor) {
    valueEl.style.color = forcedColor
  } else {
    const playingColor = getComputedStyle(document.documentElement).getPropertyValue('--playing-color').trim()
    valueEl.style.color = playingColor || ''
  }

  let currentValue = parseFloat(valueEl.textContent)
  if (isNaN(currentValue)) currentValue = targetDb

  const updateFrame = () => {
    currentValue += (targetDb - currentValue) * 0.16
    if (Math.abs(currentValue - targetDb) < 0.5) {
      valueEl.textContent = targetDb
      return
    }
    valueEl.textContent = Math.round(currentValue)
    dbRafId = requestAnimationFrame(updateFrame)
  }
  updateFrame()
}
