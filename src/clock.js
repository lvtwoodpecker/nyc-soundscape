import { SOUND_COLORS } from './personas.js'

const R_OUTER = 220
const R_INNER = 100
const R_LABEL = 238

export function hourToAngle(h) {
  return (h / 24) * 2 * Math.PI - Math.PI / 2
}

export function polarToXY(angle, r) {
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
}

export function describeArc(h, innerR, outerR) {
  const startAngle = hourToAngle(h)
  const endAngle = hourToAngle(h + 1) - 0.01
  const x1 = Math.cos(startAngle) * outerR
  const y1 = Math.sin(startAngle) * outerR
  const x2 = Math.cos(endAngle) * outerR
  const y2 = Math.sin(endAngle) * outerR
  const x3 = Math.cos(endAngle) * innerR
  const y3 = Math.sin(endAngle) * innerR
  const x4 = Math.cos(startAngle) * innerR
  const y4 = Math.sin(startAngle) * innerR
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`
}

export function getDominantColor(sounds) {
  if (!sounds || sounds.length === 0) return '#1e2240'
  const first = sounds[0]
  return SOUND_COLORS[first] || '#a29bfe'
}

export function showTooltip(e, h, persona) {
  const tt = document.getElementById('hour-tooltip')
  const data = persona ? persona.schedule[h] : null
  if (!data) return

  const displayH = h === 0 ? '12' : h > 12 ? h - 12 : h
  const suffix = h < 12 ? 'AM' : 'PM'
  document.getElementById('tt-title').textContent = `${displayH}:00 ${suffix} — ${data.loc}`

  const soundChips = data.sounds.map(s =>
    `<span class="sound-chip" style="color:${SOUND_COLORS[s]||'#666'}">${s}</span>`
  ).join('')
  document.getElementById('tt-sounds').innerHTML = soundChips || '<span style="color:var(--muted);font-size:0.65rem">No sounds recorded</span>'
  document.getElementById('tt-desc').textContent = data.desc

  tt.classList.add('visible')
  moveTooltip(e)
}

export function moveTooltip(e) {
  const tt = document.getElementById('hour-tooltip')
  const rect = document.getElementById('clock-svg').getBoundingClientRect()
  const x = e.clientX - rect.left - 110
  const y = e.clientY - rect.top - 110
  tt.style.left = Math.max(10, Math.min(x, window.innerWidth - 220)) + 'px'
  tt.style.top = Math.max(10, Math.min(y, window.innerHeight - 200)) + 'px'
}

export function hideTooltip() {
  document.getElementById('hour-tooltip').classList.remove('visible')
}

export function drawClock(persona, selectedHour) {
  const svg = document.getElementById('clock-svg')
  svg.innerHTML = ''

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  for (const [k, c] of Object.entries(SOUND_COLORS)) {
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
    f.setAttribute('id', `glow-${k}`)
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    fe.setAttribute('dx', '0')
    fe.setAttribute('dy', '0')
    fe.setAttribute('stdDeviation', '6')
    fe.setAttribute('flood-color', c)
    fe.setAttribute('flood-opacity', '0.8')
    f.appendChild(fe)
    defs.appendChild(f)
  }
  svg.appendChild(defs)

  for (let r = R_INNER; r <= R_OUTER; r += (R_OUTER - R_INNER) / 4) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    ring.setAttribute('r', r)
    ring.setAttribute('cx', 0)
    ring.setAttribute('cy', 0)
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', '#1e2240')
    ring.setAttribute('stroke-width', '0.5')
    svg.appendChild(ring)
  }

  const amLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  amLabel.setAttribute('x', 0)
  amLabel.setAttribute('y', -R_INNER + 25)
  amLabel.setAttribute('text-anchor', 'middle')
  amLabel.setAttribute('class', 'hour-label')
  amLabel.setAttribute('font-size', '7')
  amLabel.setAttribute('fill', '#3a3f6a')
  amLabel.textContent = 'AM'
  svg.appendChild(amLabel)

  const pmLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  pmLabel.setAttribute('x', 0)
  pmLabel.setAttribute('y', R_INNER - 15)
  pmLabel.setAttribute('text-anchor', 'middle')
  pmLabel.setAttribute('class', 'hour-label')
  pmLabel.setAttribute('font-size', '7')
  pmLabel.setAttribute('fill', '#3a3f6a')
  pmLabel.textContent = 'PM'
  svg.appendChild(pmLabel)

  for (let h = 0; h < 24; h++) {
    let sounds = []
    let db = 0
    if (persona) {
      const data = persona.schedule[h]
      sounds = data.sounds
      db = data.db
    }

    const color = getDominantColor(sounds)
    const isSelected = h === selectedHour
    const dbFactor = db > 0 ? (db - 35) / 65 : 0
    const segR = R_INNER + dbFactor * (R_OUTER - R_INNER) * 0.95

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', describeArc(h, R_INNER, Math.max(R_INNER + 4, segR)))
    path.setAttribute('fill', sounds.length > 0 ? color : '#13162a')
    path.setAttribute('opacity', isSelected ? '1' : sounds.length > 0 ? '0.65' : '0.3')
    if (isSelected && sounds.length > 0) {
      path.setAttribute('filter', `url(#glow-${sounds[0]})`)
    }
    path.setAttribute('stroke', '#070810')
    path.setAttribute('stroke-width', '1')
    path.style.cursor = 'pointer'
    path.style.transition = 'opacity 0.2s, transform 0.2s'

    path.addEventListener('mouseenter', (e) => showTooltip(e, h, persona))
    path.addEventListener('mousemove', (e) => moveTooltip(e))
    path.addEventListener('mouseleave', () => hideTooltip())
    path.addEventListener('click', () => window.updateHourGlobal?.(h))
    svg.appendChild(path)

    if (sounds.length > 1) {
      sounds.slice(1).forEach((s, si) => {
        const dotAngle = hourToAngle(h) + (hourToAngle(h + 1) - hourToAngle(h)) * 0.5
        const dotR = R_INNER + 12 + si * 10
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', Math.cos(dotAngle) * dotR)
        dot.setAttribute('cy', Math.sin(dotAngle) * dotR)
        dot.setAttribute('r', '3')
        dot.setAttribute('fill', SOUND_COLORS[s] || '#666')
        dot.setAttribute('opacity', '0.8')
        dot.style.pointerEvents = 'none'
        svg.appendChild(dot)
      })
    }

    const midAngle = hourToAngle(h) + (hourToAngle(h + 1) - hourToAngle(h)) / 2
    const labelPos = polarToXY(midAngle, R_LABEL)
    if (h % 3 === 0) {
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      lbl.setAttribute('x', labelPos.x)
      lbl.setAttribute('y', labelPos.y)
      lbl.setAttribute('text-anchor', 'middle')
      lbl.setAttribute('dominant-baseline', 'middle')
      lbl.setAttribute('class', 'hour-label')
      lbl.setAttribute('font-size', '9')
      const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
      const suffix = h < 12 ? 'am' : 'pm'
      lbl.textContent = displayH + suffix
      svg.appendChild(lbl)
    }
  }

  const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  centerCircle.setAttribute('r', R_INNER - 2)
  centerCircle.setAttribute('fill', '#070810')
  svg.appendChild(centerCircle)

  if (persona) {
    const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameEl.setAttribute('x', 0)
    nameEl.setAttribute('y', -14)
    nameEl.setAttribute('text-anchor', 'middle')
    nameEl.setAttribute('font-family', 'Syne, sans-serif')
    nameEl.setAttribute('font-weight', '700')
    nameEl.setAttribute('font-size', '18')
    nameEl.setAttribute('fill', persona.color)
    nameEl.textContent = persona.name
    svg.appendChild(nameEl)

    const roleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    roleEl.setAttribute('x', 0)
    roleEl.setAttribute('y', 6)
    roleEl.setAttribute('text-anchor', 'middle')
    roleEl.setAttribute('font-family', 'DM Mono, monospace')
    roleEl.setAttribute('font-size', '8')
    roleEl.setAttribute('fill', '#5a5f8a')
    roleEl.textContent = persona.role
    svg.appendChild(roleEl)

    const boroughEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    boroughEl.setAttribute('x', 0)
    boroughEl.setAttribute('y', 20)
    boroughEl.setAttribute('text-anchor', 'middle')
    boroughEl.setAttribute('font-family', 'DM Mono, monospace')
    boroughEl.setAttribute('font-size', '7')
    boroughEl.setAttribute('fill', '#3a3f6a')
    boroughEl.textContent = persona.borough.toUpperCase()
    svg.appendChild(boroughEl)
  } else {
    const hint = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    hint.setAttribute('x', 0)
    hint.setAttribute('y', 0)
    hint.setAttribute('text-anchor', 'middle')
    hint.setAttribute('dominant-baseline', 'middle')
    hint.setAttribute('font-family', 'DM Mono, monospace')
    hint.setAttribute('font-size', '8')
    hint.setAttribute('fill', '#3a3f6a')
    hint.textContent = 'SELECT A PERSONA'
    svg.appendChild(hint)
  }

  if (persona) {
    const needleAngle = hourToAngle(selectedHour) + (hourToAngle(selectedHour + 1) - hourToAngle(selectedHour)) / 2
    const n1 = polarToXY(needleAngle, R_INNER - 6)
    const n2 = polarToXY(needleAngle, R_OUTER + 14)
    const needle = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    needle.setAttribute('x1', n1.x)
    needle.setAttribute('y1', n1.y)
    needle.setAttribute('x2', n2.x)
    needle.setAttribute('y2', n2.y)
    needle.setAttribute('stroke', 'white')
    needle.setAttribute('stroke-width', '1.5')
    needle.setAttribute('opacity', '0.4')
    svg.appendChild(needle)
  }
}
