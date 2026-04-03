import { SOUND_COLORS } from './personas.js'

const R_OUTER = 220
const R_INNER = 100
const R_LABEL = 238
const DEFAULT_DB_BOUNDS = { low: 58, high: 84 }

let cachedBoundsSource = null
let cachedBounds = DEFAULT_DB_BOUNDS

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// when present, these classes always take priority for dominant sound
export const DOMINANT_PRIORITY = ['voice', 'music', 'dog']

export const SOUND_THRESHOLDS = {
  engine: 0.15,
  machinery: 0.10,
  impact: 0.08,
  saw: 0.08,
  alert: 0.12,
  music: 0.08,
  voice: 0.18,
  dog: 0.08,
}

export function pickDominantSound(sounds, prevalence = {}) {
  if (!sounds || sounds.length === 0) return null
  const eligible = sounds.filter(s => (prevalence[s] || 0) >= (SOUND_THRESHOLDS[s] ?? 0))
  const pool = eligible.length > 0 ? eligible : sounds
  const priority = DOMINANT_PRIORITY.find(s => pool.includes(s))
  if (priority) return priority
  return pool.slice().sort((a, b) => (prevalence[b] || 0) - (prevalence[a] || 0))[0] || pool[0]
}

function featureColor(sounds, prevalence) {
  if (!sounds || sounds.length === 0) return '#e4e3de'
  const top = pickDominantSound(sounds, prevalence)
  return SOUND_COLORS[top] || '#e4e3de'
}

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
  if (!sounds || sounds.length === 0) return '#e4e3de'
  const first = sounds[0]
  return SOUND_COLORS[first] || '#6b5fd4'
}

export function showTooltip(e, h, persona, hourlyStats) {
  const tt = document.getElementById('hour-tooltip')
  const data = persona ? persona.schedule[h] : null
  if (!data) return

  const displayH = h === 0 ? '12' : h > 12 ? h - 12 : h
  const suffix = h < 12 ? 'AM' : 'PM'
  document.getElementById('tt-title').textContent = `${displayH}:00 ${suffix} — ${data.loc}`

  let sounds = []
  if (hourlyStats) {
    const bData = hourlyStats.by_borough[String(data.borough)]
    const hData = bData?.[String(h)]
    if (hData) {
      sounds = Object.entries(hData.prevalence)
        .filter(([, v]) => v >= 0.05)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k)
        .slice(0, 4)
    }
  }

  const soundChips = sounds.map(s =>
    `<span class="sound-chip" style="color:${SOUND_COLORS[s]||'#666'}">${s}</span>`
  ).join('')
  document.getElementById('tt-sounds').innerHTML = soundChips || '<span style="color:var(--muted);font-size:0.9rem">No data this hour</span>'
  document.getElementById('tt-desc').textContent = h === 0
    ? 'The city never stops.'
    : data.desc

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

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const t = idx - lo
  return sorted[lo] * (1 - t) + sorted[hi] * t
}

function getGlobalDbBounds(hourlyStats) {
  if (!hourlyStats?.by_borough) return DEFAULT_DB_BOUNDS
  if (cachedBoundsSource === hourlyStats) return cachedBounds

  const dbValues = []
  const byBorough = hourlyStats.by_borough
  for (const hours of Object.values(byBorough)) {
    for (const hData of Object.values(hours || {})) {
      const db = hData?.db
      if (Number.isFinite(db) && db > 0) dbValues.push(db)
    }
  }

  if (dbValues.length < 10) {
    cachedBoundsSource = hourlyStats
    cachedBounds = DEFAULT_DB_BOUNDS
    return cachedBounds
  }

  dbValues.sort((a, b) => a - b)
  let low = percentile(dbValues, 0.1)
  let high = percentile(dbValues, 0.9)

  if (!Number.isFinite(low) || !Number.isFinite(high) || high - low < 1) {
    low = dbValues[0]
    high = dbValues[dbValues.length - 1]
  }
  if (high - low < 1) high = low + 1

  cachedBoundsSource = hourlyStats
  cachedBounds = { low, high }
  return cachedBounds
}

function dbToFactor(db, bounds) {
  if (!Number.isFinite(db) || db <= 0) return 0
  const norm = (db - bounds.low) / (bounds.high - bounds.low)
  const clamped = Math.max(0, Math.min(1, norm))
  const curved = Math.pow(clamped, 0.78)
  // keep active hours visibly present and use more of the radial space
  return 0.22 + 0.78 * curved
}

// attach once — svg.innerHTML = '' doesn't remove listeners on the svg itself
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('clock-svg')?.addEventListener('mouseleave', () => hideTooltip())
})

export function drawClock(persona, selectedHour, hourlyStats) {
  const svg = document.getElementById('clock-svg')
  svg.innerHTML = ''
  const dbBounds = getGlobalDbBounds(hourlyStats)

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  for (const [k, c] of Object.entries(SOUND_COLORS)) {
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
    f.setAttribute('id', `glow-${k}`)
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    fe.setAttribute('dx', '0')
    fe.setAttribute('dy', '0')
    fe.setAttribute('stdDeviation', '6')
    fe.setAttribute('flood-color', c)
    fe.setAttribute('flood-opacity', '0.4')
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
    ring.setAttribute('stroke', cssVar('--clock-ring', '#d8d7d2'))
    ring.setAttribute('stroke-width', '0.5')
    svg.appendChild(ring)
  }

  const amLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  amLabel.setAttribute('x', 0)
  amLabel.setAttribute('y', -R_INNER + 25)
  amLabel.setAttribute('text-anchor', 'middle')
  amLabel.setAttribute('class', 'hour-label')
  amLabel.setAttribute('font-size', '14')
  amLabel.setAttribute('fill', cssVar('--clock-label', '#aaa'))
  amLabel.textContent = 'AM'
  svg.appendChild(amLabel)

  const pmLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  pmLabel.setAttribute('x', 0)
  pmLabel.setAttribute('y', R_INNER - 15)
  pmLabel.setAttribute('text-anchor', 'middle')
  pmLabel.setAttribute('class', 'hour-label')
  pmLabel.setAttribute('font-size', '14')
  pmLabel.setAttribute('fill', cssVar('--clock-label', '#aaa'))
  pmLabel.textContent = 'PM'
  svg.appendChild(pmLabel)

  for (let h = 0; h < 24; h++) {
    let sounds = []
    let prevalence = {}
    let db = 0
    if (persona) {
      const hourEntry = persona.schedule[h]
      if (hourlyStats) {
        const bData = hourlyStats.by_borough[String(hourEntry.borough)]
        const hData = bData?.[String(h)]
        if (hData) {
          prevalence = hData.prevalence
          sounds = Object.entries(prevalence)
            .filter(([, v]) => v >= 0.05)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k)
            .slice(0, 4)
          db = hData.db
        }
      }
    }

    const color = featureColor(sounds, prevalence)
    const isSelected = h === selectedHour
    const dbFactor = sounds.length > 0 ? dbToFactor(db, dbBounds) : 0
    const segR = R_INNER + dbFactor * (R_OUTER - R_INNER)
    const outerR = sounds.length > 0 ? Math.max(R_INNER + 4, segR) : R_INNER + 2

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', describeArc(h, R_INNER, outerR))
    path.setAttribute('fill', sounds.length > 0 ? color : '#e4e3de')
    path.setAttribute('opacity', isSelected ? '1' : sounds.length > 0 ? '0.65' : '0.3')
    if (isSelected && sounds.length > 0) {
      const glowSound = pickDominantSound(sounds, prevalence)
      path.setAttribute('filter', `url(#glow-${glowSound})`)
    }
    path.setAttribute('stroke', cssVar('--clock-stroke', '#f7f6f2'))
    path.setAttribute('stroke-width', '1')
    path.style.cursor = 'pointer'
    path.style.transition = 'opacity 0.2s'

    path.addEventListener('mouseenter', (e) => showTooltip(e, h, persona, hourlyStats))
    path.addEventListener('mousemove', (e) => moveTooltip(e))
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
      lbl.setAttribute('font-size', '16')
      const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
      const suffix = h < 12 ? 'am' : 'pm'
      lbl.textContent = displayH + suffix
      svg.appendChild(lbl)
    }
  }

  const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  centerCircle.setAttribute('r', R_INNER - 2)
  centerCircle.setAttribute('fill', cssVar('--clock-center', '#f7f6f2'))
  svg.appendChild(centerCircle)

  if (persona) {
    const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameEl.setAttribute('x', 0)
    nameEl.setAttribute('y', -14)
    nameEl.setAttribute('text-anchor', 'middle')
    nameEl.setAttribute('font-family', 'Crimson Pro, serif')
    nameEl.setAttribute('font-weight', '700')
    nameEl.setAttribute('font-size', '24')
    nameEl.setAttribute('fill', persona.color)
    nameEl.textContent = persona.name
    svg.appendChild(nameEl)

    const roleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    roleEl.setAttribute('x', 0)
    roleEl.setAttribute('y', 6)
    roleEl.setAttribute('text-anchor', 'middle')
    roleEl.setAttribute('font-family', 'DM Mono, monospace')
    roleEl.setAttribute('font-size', '14')
    roleEl.setAttribute('fill', cssVar('--clock-role', '#888884'))
    roleEl.textContent = persona.role
    svg.appendChild(roleEl)

    const boroughEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    boroughEl.setAttribute('x', 0)
    boroughEl.setAttribute('y', 20)
    boroughEl.setAttribute('text-anchor', 'middle')
    boroughEl.setAttribute('font-family', 'DM Mono, monospace')
    boroughEl.setAttribute('font-size', '12')
    boroughEl.setAttribute('fill', cssVar('--clock-subtext', '#aaa'))
    boroughEl.textContent = (persona.home || '').toUpperCase()
    svg.appendChild(boroughEl)
  } else {
    const hint = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    hint.setAttribute('x', 0)
    hint.setAttribute('y', 0)
    hint.setAttribute('text-anchor', 'middle')
    hint.setAttribute('dominant-baseline', 'middle')
    hint.setAttribute('font-family', 'DM Mono, monospace')
    hint.setAttribute('font-size', '14')
    hint.setAttribute('fill', cssVar('--clock-subtext', '#aaa'))
    hint.textContent = 'SELECT A PERSONA'
    svg.appendChild(hint)
  }

  if (persona) {
    const needleAngle = hourToAngle(selectedHour) + (hourToAngle(selectedHour + 1) - hourToAngle(selectedHour)) / 2
    const n1 = polarToXY(needleAngle, R_INNER - 6)
    const n2 = polarToXY(needleAngle, R_OUTER + 14)
    const needle = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    needle.setAttribute('id', 'clock-needle-line')
    needle.setAttribute('x1', n1.x)
    needle.setAttribute('y1', n1.y)
    needle.setAttribute('x2', n2.x)
    needle.setAttribute('y2', n2.y)
    needle.setAttribute('stroke', cssVar('--clock-needle', '#ffffff'))
    needle.setAttribute('stroke-width', '1.5')
    svg.appendChild(needle)
  }
}
