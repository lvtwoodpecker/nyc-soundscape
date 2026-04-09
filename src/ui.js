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
    `<div class="persona-card" id="persona-${p.id}" style="--accent:${p.color}" role="button" tabindex="0" aria-pressed="false">
      <div class="persona-name">${p.name}</div>
      <div class="persona-meta">${p.role}</div>
      <span class="persona-borough" style="color:${p.color}">${p.home}</span>
    </div>`
  ).join('')

  document.querySelectorAll('.persona-card').forEach(card => {
    const id = card.id.replace('persona-', '')
    card.addEventListener('click', () => onSelect(id))
    card.addEventListener('keydown', e => {
      if (e.key === ' ') {
        e.preventDefault()
        onSelect(id)
      }
    })
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

export function renderStory(currentHour, allStories) {
  const el = document.getElementById('journey-desc-text')
  if (!el) return
  
  if (!allStories || Object.keys(allStories).length === 0) {
    el.innerHTML = ''
    return
  }
  
  const current = allStories[currentHour]
  if (!current) {
    el.innerHTML = ''
    return
  }

  // Build circular wrap-around list of the other 23 hours.
  // First item is the previous hour, last item is the next hour.
  const otherHours = []
  for (let i = 1; i < 24; i++) {
    const h = (currentHour + 24 - i) % 24
    const entry = allStories[h]
    if (entry) otherHours.push([String(h), entry])
  }
  
  const currentHTML = `
    <div class="story-current">
      <div class="story-current-time">${current.displayH}:00 ${current.suffix}</div>
      <div class="story-current-desc">${current.desc}</div>
    </div>
  `
  
  const pastHTML = otherHours.length > 0 ? `
    <div class="story-history">
      ${otherHours.map(([h, { displayH, suffix, desc }]) =>
        `<button type="button" class="story-entry" data-hour="${h}" aria-label="Seek to ${displayH}:00 ${suffix}">
          <span class="story-time">${displayH}:00 ${suffix}</span>
          <span class="story-desc">${desc}</span>
        </button>`
      ).join('')}
    </div>
  ` : ''
  
  el.innerHTML = currentHTML + pastHTML

  el.querySelectorAll('.story-entry').forEach(btn => {
    btn.addEventListener('keydown', e => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
      }
    })
  })
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
      valueEl.textContent = Math.round(targetDb)
      return
    }
    valueEl.textContent = Math.round(currentValue)
    dbRafId = requestAnimationFrame(updateFrame)
  }
  updateFrame()
}
