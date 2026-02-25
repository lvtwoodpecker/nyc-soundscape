import { SOUND_COLORS, PERSONAS } from './personas.js'

export function renderLegend() {
  const el = document.getElementById('legend')
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
    `<div class="persona-card" id="persona-${p.id}" style="--accent:${p.color}">
      <div class="persona-name" style="color:${p.color}">${p.name}</div>
      <div class="persona-meta">${p.role}</div>
      <span class="persona-borough" style="color:${p.color}">${p.borough}</span>
    </div>`
  ).join('')
  
  document.querySelectorAll('.persona-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = card.id.replace('persona-', '')
      onSelect(id)
    })
  })
}

export function renderSoundsList(sounds, db, noData) {
  const el = document.getElementById('sounds-list')
  if (noData) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.68rem;margin-top:8px;line-height:1.6">Data unavailable for this location and hour.<br/>Displaying flatline tone.</div>'
    return
  }
  if (!sounds || sounds.length === 0) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.68rem;margin-top:8px">No sounds detected this hour.</div>'
    return
  }
  el.innerHTML = sounds.map(s => `
    <div class="sound-row" data-sound="${s}" onclick="window.playSoundGlobal?.('${s}', ${db})">
      <div class="sound-dot" style="background:${SOUND_COLORS[s]};color:${SOUND_COLORS[s]}"></div>
      <div class="sound-name">${s}</div>
      <div class="sound-play-btn">PLAY</div>
    </div>
  `).join('')
}

export function animateDbMeter(targetDb) {
  const valueEl = document.getElementById('db-value')
  const fillEl = document.getElementById('meter-fill')
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
