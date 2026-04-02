import { SOUND_COLORS, SOUND_FINE, PERSONAS } from './personas.js'

export function renderLegend() {
  const el = document.getElementById('legend')
  if (!el) return
  el.innerHTML = Object.entries(SOUND_COLORS).map(([k, c]) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${c};box-shadow:0 0 4px ${c}"></div>
      <span>${k}</span>
    </div>`
  ).join('')
}

export function renderPersonas(onSelect) {
  const el = document.getElementById('persona-list')
  el.innerHTML = PERSONAS.map(p =>
    `<div class="persona-card" id="persona-${p.id}" style="--accent:${p.color}" role="button" tabindex="0">
      <div class="persona-name" style="color:${p.color}">${p.name}</div>
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
  const tagsEl = document.getElementById('fine-tags-list')

  if (noData) {
    el.innerHTML = '<div class="sounds-empty">Data unavailable for this location and hour.<br/>Displaying flatline tone.</div>'
    if (tagsEl) tagsEl.innerHTML = ''
    return
  }
  if (!sounds || sounds.length === 0) {
    el.innerHTML = '<div class="sounds-empty">No sounds detected this hour.</div>'
    if (tagsEl) tagsEl.innerHTML = ''
    return
  }
  el.innerHTML = sounds.map(s => `
    <div class="sound-row" data-sound="${s}" onclick="window.playSoundGlobal?.('${s}', ${db})">
      <div class="sound-dot" style="background:${SOUND_COLORS[s]};color:${SOUND_COLORS[s]}"></div>
      <div class="sound-name">${s}</div>
      <div class="sound-play-btn">PLAY</div>
    </div>
  `).join('')

  if (tagsEl) {
    const fineTags = sounds.flatMap(s => (SOUND_FINE[s] || []).slice(0, 2))
    tagsEl.innerHTML = fineTags.map(tag => `<div class="fine-tag">· ${tag}</div>`).join('')
  }
}

export function setPlayingColor(color) {
  document.documentElement.style.setProperty('--playing-color', color || '')
}

export function animateDbMeter(targetDb) {
  const valueEl = document.getElementById('db-value')
  const fillEl = document.getElementById('meter-fill')

  // tint the dB number toward the playing sound's color at higher levels
  const playingColor = getComputedStyle(document.documentElement).getPropertyValue('--playing-color').trim()
  const dBFrac = Math.min(1, Math.max(0, (targetDb - 50) / 40))
  valueEl.style.color = (playingColor && dBFrac > 0.35) ? playingColor : ''

  const updateFrame = () => {
    const current = parseFloat(valueEl.textContent)
    if (isNaN(current)) {
      valueEl.textContent = targetDb
      fillEl.style.width = Math.min(100, (targetDb - 35) / 65 * 100) + '%'
      return
    }
    const next = current + (targetDb - current) * 0.1
    if (Math.abs(next - targetDb) < 0.5) {
      valueEl.textContent = targetDb
      fillEl.style.width = Math.min(100, (targetDb - 35) / 65 * 100) + '%'
      return
    }
    valueEl.textContent = Math.round(next)
    fillEl.style.width = Math.min(100, (next - 35) / 65 * 100) + '%'
    requestAnimationFrame(updateFrame)
  }
  updateFrame()
}
