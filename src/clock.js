import { SOUND_COLORS, getSoundColor } from './personas.js'
import { clipAssignments } from './audio.js'

const R_OUTER = 220
const R_INNER = 100
const R_LABEL = 238
const DEFAULT_DB_BOUNDS = { low: 58, high: 84 }

let cachedBoundsSource = null
let cachedBounds = DEFAULT_DB_BOUNDS

// tracks the last full draw so updateClockHour can do a cheap diff
let clockDrawnHour = -1

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// when present, these classes still get a small lift for generic scenes
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

export const MIN_SOUND_PREVALENCE = 0.005

const DEFAULT_SOUND_CURVE = {
  gamma: 1.05,
  focusBoosts: [0.07, 0.05, 0.03, 0.015],
  thresholdPenalty: 0.03,
  priorityBoost: 0.02,
}

function getSoundCurve(persona) {
  const curve = persona?.soundCurve || {}
  return {
    gamma: Number.isFinite(curve.gamma) ? curve.gamma : DEFAULT_SOUND_CURVE.gamma,
    focusBoosts: Array.isArray(curve.focusBoosts) ? curve.focusBoosts : DEFAULT_SOUND_CURVE.focusBoosts,
    thresholdPenalty: Number.isFinite(curve.thresholdPenalty) ? curve.thresholdPenalty : DEFAULT_SOUND_CURVE.thresholdPenalty,
    priorityBoost: Number.isFinite(curve.priorityBoost) ? curve.priorityBoost : DEFAULT_SOUND_CURVE.priorityBoost,
  }
}

function scoreSound(sound, prevalence, persona = null) {
  const focus = persona?.soundFocus || []
  const weights = persona?.soundWeights || {}
  const curve = getSoundCurve(persona)

  const base = prevalence[sound] || 0
  let score = Math.pow(Math.max(base, 0), curve.gamma) + base * 0.28
  const threshold = SOUND_THRESHOLDS[sound] ?? 0
  if (base < threshold) score -= curve.thresholdPenalty

  const focusIndex = focus.indexOf(sound)
  if (focusIndex >= 0) {
    const focusBoost = curve.focusBoosts[focusIndex] ?? 0.03
    score += focusBoost * (0.35 + base)
  }

  const priorityIndex = DOMINANT_PRIORITY.indexOf(sound)
  if (priorityIndex >= 0) {
    score += Math.max(0.015, curve.priorityBoost - priorityIndex * 0.015)
  }

  const weight = weights[sound] ?? 1
  // keep persona character without letting one class monopolize every hour
  score *= 1 + (weight - 1) * 0.35
  return score
}

export function rankSounds(sounds, prevalence = {}, persona = null) {
  if (!sounds || sounds.length === 0) return []
  const pool = sounds.filter(s => (prevalence[s] || 0) >= MIN_SOUND_PREVALENCE)
  const candidates = pool.length > 0 ? pool : [...sounds]
  return [...candidates].sort((a, b) => {
    const scoreDiff = scoreSound(b, prevalence, persona) - scoreSound(a, prevalence, persona)
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff
    return (prevalence[b] || 0) - (prevalence[a] || 0)
  })
}

export function pickDominantSound(sounds, prevalence = {}, persona = null) {
  return rankSounds(sounds, prevalence, persona)[0] || null
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function seededFloat(persona, hour, salt = 'seed') {
  const seed = `${persona?.id || 'none'}:${hour}:${salt}`
  return (hashString(seed) % 10000) / 10000
}

export function pickVisualSound(sounds, prevalence = {}, persona = null, hour = 0) {
  const ranked = rankSounds(sounds, prevalence, persona)
  if (ranked.length === 0) return null
  if (ranked.length === 1) return ranked[0]

  const pool = ranked.slice(0, Math.min(5, ranked.length))
  const weighted = pool.map((sound, idx) => {
    const base = Math.max(prevalence[sound] || 0.005, 0.005)
    const rankPenalty = 1 - idx * 0.12
    const focusIndex = (persona?.soundFocus || []).indexOf(sound)
    const focusLift = focusIndex >= 0 ? 1 + Math.max(0.03, 0.11 - focusIndex * 0.02) : 1
    // flatten differences so secondary classes show up more often
    const expressive = Math.pow(base * rankPenalty * focusLift, 0.62)
    return { sound, w: Math.max(0.001, expressive) }
  })

  const total = weighted.reduce((acc, x) => acc + x.w, 0)
  if (!Number.isFinite(total) || total <= 0) return pool[0]

  let t = seededFloat(persona, hour, 'visual') * total
  for (const item of weighted) {
    t -= item.w
    if (t <= 0) return item.sound
  }
  return weighted[weighted.length - 1].sound
}

function featureColor(sounds, prevalence, persona, hour) {
  if (!sounds || sounds.length === 0) return '#e4e3de'
  const top = pickVisualSound(sounds, prevalence, persona, hour)
  return getSoundColor(top) || '#e4e3de'
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
      const ranked = rankSounds(
        Object.entries(hData.prevalence)
          .filter(([, v]) => v >= MIN_SOUND_PREVALENCE)
          .map(([k]) => k),
        hData.prevalence,
        persona
      )
      sounds = ranked.slice(0, 4)
    }
  }

  const soundChips = sounds.map(s =>
    `<span class="sound-chip" style="color:${getSoundColor(s)||'#666'}">${s}</span>`
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
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('clock-svg')?.addEventListener('mouseleave', () => hideTooltip())
  })
}

export function drawClock(persona, selectedHour, hourlyStats) {
  const svg = document.getElementById('clock-svg')
  svg.innerHTML = ''
  const dbBounds = getGlobalDbBounds(hourlyStats)

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  for (const k of Object.keys(SOUND_COLORS)) {
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
    f.setAttribute('id', `glow-${k}`)
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    fe.setAttribute('dx', '0')
    fe.setAttribute('dy', '0')
    fe.setAttribute('stdDeviation', '6')
    fe.setAttribute('flood-color', getSoundColor(k))
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
          sounds = rankSounds(
            Object.entries(prevalence)
              .filter(([, v]) => v >= MIN_SOUND_PREVALENCE)
              .map(([k]) => k),
            prevalence,
            persona
          ).slice(0, 4)
          db = hData.db
        }
      }
    }

    const assignedType = persona ? clipAssignments[`${persona.id}:${h}`]?.type : null
    const color = assignedType ? (getSoundColor(assignedType) || featureColor(sounds, prevalence, persona, h)) : featureColor(sounds, prevalence, persona, h)
    const isSelected = h === selectedHour
    const dbFactor = sounds.length > 0 ? dbToFactor(db, dbBounds) : 0
    const segR = R_INNER + dbFactor * (R_OUTER - R_INNER)
    const outerR = sounds.length > 0 ? Math.max(R_INNER + 4, segR) : R_INNER + 2

    const glowSound = (sounds.length > 0 && isSelected) ? pickDominantSound(sounds, prevalence, persona) : null
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', describeArc(h, R_INNER, outerR))
    path.setAttribute('fill', sounds.length > 0 ? color : '#e4e3de')
    path.setAttribute('opacity', isSelected ? '1' : sounds.length > 0 ? '0.65' : '0.3')
    path.setAttribute('data-hour', h)
    path.setAttribute('data-has-data', sounds.length > 0 ? '1' : '0')
    path.setAttribute('data-glow', sounds.length > 0 ? (pickDominantSound(sounds, prevalence, persona) || '') : '')
    if (glowSound) path.setAttribute('filter', `url(#glow-${glowSound})`)
    path.setAttribute('stroke', cssVar('--clock-stroke', '#f7f6f2'))
    path.setAttribute('stroke-width', '1')
    path.style.cursor = 'pointer'
    path.style.transition = 'opacity 0.2s'

    const displayH = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
    const suffix = h < 12 ? 'AM' : 'PM'
    path.setAttribute('tabindex', '0')
    path.setAttribute('role', 'button')
    path.setAttribute('aria-label', `Jump to ${displayH}:00 ${suffix}`)
    path.addEventListener('mouseenter', (e) => showTooltip(e, h, persona, hourlyStats))
    path.addEventListener('mousemove', (e) => moveTooltip(e))
    path.addEventListener('click', () => window.updateHourGlobal?.(h))
    path.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        window.updateHourGlobal?.(h)
      }
    })
    svg.appendChild(path)

    if (sounds.length > 1) {
      sounds.slice(1).forEach((s, si) => {
        const dotAngle = hourToAngle(h) + (hourToAngle(h + 1) - hourToAngle(h)) * 0.5
        const dotR = R_INNER + 12 + si * 10
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', Math.cos(dotAngle) * dotR)
        dot.setAttribute('cy', Math.sin(dotAngle) * dotR)
        dot.setAttribute('r', '3')
        dot.setAttribute('fill', getSoundColor(s) || '#666')
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
    roleEl.setAttribute('y', 2)
    roleEl.setAttribute('text-anchor', 'middle')
    roleEl.setAttribute('font-family', 'DM Mono, monospace')
    roleEl.setAttribute('font-size', '14')
    roleEl.setAttribute('fill', cssVar('--clock-role', '#888884'))
    roleEl.textContent = persona.clockRole || persona.role
    svg.appendChild(roleEl)

    if (persona.clockSubtitle) {
      const subEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      subEl.setAttribute('x', 0)
      subEl.setAttribute('y', 22)
      subEl.setAttribute('text-anchor', 'middle')
      subEl.setAttribute('font-family', 'DM Mono, monospace')
      subEl.setAttribute('font-size', '12')
      subEl.setAttribute('fill', persona.color)
      subEl.setAttribute('opacity', '1')
      subEl.textContent = persona.clockSubtitle
      svg.appendChild(subEl)
    }
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

  clockDrawnHour = selectedHour
}

// cheap update: only moves the needle + swaps selection highlight, no SVG rebuild
export function updateClockHour(selectedHour) {
  const svg = document.getElementById('clock-svg')
  if (!svg || clockDrawnHour < 0) return

  // deselect previous
  const prev = svg.querySelector(`path[data-hour="${clockDrawnHour}"]`)
  if (prev) {
    prev.setAttribute('opacity', prev.dataset.hasData === '1' ? '0.65' : '0.3')
    prev.removeAttribute('filter')
  }

  // select new
  const next = svg.querySelector(`path[data-hour="${selectedHour}"]`)
  if (next) {
    next.setAttribute('opacity', '1')
    const g = next.dataset.glow
    if (g) next.setAttribute('filter', `url(#glow-${g})`)
  }

  // move needle
  const needle = document.getElementById('clock-needle-line')
  if (needle) {
    const needleAngle = hourToAngle(selectedHour) + (hourToAngle(selectedHour + 1) - hourToAngle(selectedHour)) / 2
    const n1 = polarToXY(needleAngle, R_INNER - 6)
    const n2 = polarToXY(needleAngle, R_OUTER + 14)
    needle.setAttribute('x1', n1.x)
    needle.setAttribute('y1', n1.y)
    needle.setAttribute('x2', n2.x)
    needle.setAttribute('y2', n2.y)
  }

  clockDrawnHour = selectedHour
}
