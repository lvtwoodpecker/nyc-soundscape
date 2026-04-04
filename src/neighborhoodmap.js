// Manhattan beehive hex map — pure SVG, no dependencies

const SVG_W = 340
const SVG_H = 530

// geographic bounds (covers Battery Park to UWS/UES)
const LAT_MIN = 40.697, LAT_MAX = 40.786
const LNG_MIN = -74.023, LNG_MAX = -73.937

// simplified Manhattan outline polygon [lat, lng]
// going counterclockwise from Battery Park southern tip
const MANHATTAN_POLY = [
  [40.700, -74.017], // Battery SW
  [40.708, -74.020], // Hudson lower W
  [40.718, -74.016], // TriBeCa W
  [40.728, -74.012], // Hudson Square W
  [40.736, -74.010], // West Village W
  [40.746, -74.005], // Meatpacking / Chelsea W
  [40.756, -74.001], // Chelsea W (23rd)
  [40.764, -73.998], // Penn / 34th W
  [40.774, -73.993], // Hell's Kitchen W
  [40.782, -73.988], // UWS / Lincoln Center W
  [40.785, -73.975], // UWS N edge W
  [40.785, -73.947], // UES N edge
  [40.778, -73.942], // UES NE / Gracie
  [40.770, -73.945], // UES E upper
  [40.758, -73.951], // Midtown E / 53rd
  [40.748, -73.957], // Midtown E / 42nd
  [40.742, -73.968], // Murray Hill / E 34th
  [40.730, -73.974], // Gramercy / E Village E
  [40.720, -73.979], // LES / Alphabet City E
  [40.710, -73.983], // Seaport / FiDi E
  [40.702, -73.990], // Battery E
  [40.700, -74.017], // back to start
]

// 3 landmark labels shown at all times (geographically placed)
const LANDMARKS = [
  { name: 'Midtown',          clat: 40.754, clng: -73.984 },
  { name: 'Washington Sq.',   clat: 40.731, clng: -74.000 },
  { name: 'Lower East Side',  clat: 40.715, clng: -73.984 },
]

const R = 13  // hex radius in SVG pixels (pointy-top)
const SQRT3 = Math.sqrt(3)

// project lat/lng to SVG pixel coordinates
function project(lat, lng) {
  const x = (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * SVG_W
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SVG_H
  return [x, y]
}

// unproject SVG pixel to lat/lng
function unproject(x, y) {
  const lng = x / SVG_W * (LNG_MAX - LNG_MIN) + LNG_MIN
  const lat = (1 - y / SVG_H) * (LAT_MAX - LAT_MIN) + LAT_MIN
  return [lat, lng]
}

// ray-casting point-in-polygon
function inPolygon(lat, lng, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// generate the hex grid vertices (pointy-top)
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 180 * (60 * i - 30)
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function applyMapLabelStyle(textEl, fillVar, strokeVar) {
  textEl.setAttribute('font-size', '9.5')
  textEl.setAttribute('font-family', 'DM Mono, monospace')
  textEl.setAttribute('font-weight', '700')
  textEl.setAttribute('letter-spacing', '0.01em')
  textEl.setAttribute('fill', cssVar(fillVar, '#1a1a1e'))
  textEl.setAttribute('stroke', cssVar(strokeVar, 'rgba(255,255,255,0.9)'))
  textEl.setAttribute('stroke-width', '2.4')
  textEl.setAttribute('paint-order', 'stroke fill')
  textEl.setAttribute('stroke-linejoin', 'round')
}

let svgEl = null
let hexEls = []    // [{ poly, lat, lng, cx, cy }]
let pathEl = null  // SVG polyline for persona trail
let dotEl  = null  // persona dot
let locLabelEl = null  // dynamic neighborhood name
let landmarkEls = []

// diff tracking — only update hexes that actually changed state
let prevCurrentHex = null
let prevVisitedSet = new Set()

export function initNeighborhoodMap() {
  const container = document.getElementById('map')
  if (!container) return

  svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgEl.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`)
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svgEl.setAttribute('role', 'img')
  svgEl.setAttribute('aria-label', 'Manhattan neighborhood map showing persona journey')
  svgEl.style.cssText = 'width:100%;height:100%;display:block;'
  container.innerHTML = ''
  container.style.cssText = 'width:100%;height:100%;overflow:hidden;'
  container.appendChild(svgEl)

  // hex column/row spacing (pointy-top)
  const colStep = SQRT3 * R        // horizontal distance between column centers
  const rowStep = 1.5 * R          // vertical distance between row centers

  const cols = Math.ceil(SVG_W / colStep) + 2
  const rows = Math.ceil(SVG_H / rowStep) + 2

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const cx = col * colStep + (row % 2 !== 0 ? colStep / 2 : 0)
      const cy = row * rowStep
      const [lat, lng] = unproject(cx, cy)
      if (!inPolygon(lat, lng, MANHATTAN_POLY)) continue

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      poly.setAttribute('points', hexPoints(cx, cy, R - 0.8))
      poly.setAttribute('fill', cssVar('--map-hex-fill', '#d6d3cc'))
      poly.setAttribute('stroke', cssVar('--map-hex-stroke', '#f5f4f0'))
      poly.setAttribute('stroke-width', '1.2')
      poly.style.transition = 'fill 0.3s ease'
      svgEl.appendChild(poly)
      hexEls.push({ poly, lat, lng, cx, cy })
    }
  }

  // landmark labels (always visible)
  landmarkEls = []
  for (const lm of LANDMARKS) {
    const [lx, ly] = project(lm.clat, lm.clng)
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('x', lx)
    text.setAttribute('y', ly)
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'middle')
    applyMapLabelStyle(text, '--map-label', '--map-label-stroke')
    text.setAttribute('pointer-events', 'none')
    text.textContent = lm.name
    svgEl.appendChild(text)
    landmarkEls.push(text)
  }

  // trail polyline (drawn below the dot)
  pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  pathEl.setAttribute('fill', 'none')
  pathEl.setAttribute('stroke-width', '1.5')
  pathEl.setAttribute('stroke-linecap', 'round')
  pathEl.setAttribute('stroke-linejoin', 'round')
  pathEl.setAttribute('opacity', '0.6')
  svgEl.appendChild(pathEl)

  // persona dot
  dotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  dotEl.setAttribute('r', '5')
  dotEl.setAttribute('fill', cssVar('--map-dot-fill', '#ccc'))
  dotEl.setAttribute('stroke', cssVar('--map-dot-stroke', '#fff'))
  dotEl.setAttribute('stroke-width', '1.5')
  dotEl.setAttribute('opacity', '0')
  svgEl.appendChild(dotEl)

  // dynamic neighborhood label — follows the dot
  locLabelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  locLabelEl.setAttribute('text-anchor', 'middle')
  locLabelEl.setAttribute('dominant-baseline', 'middle')
  applyMapLabelStyle(locLabelEl, '--map-label-active', '--map-label-active-stroke')
  locLabelEl.setAttribute('opacity', '0')
  locLabelEl.setAttribute('pointer-events', 'none')
  locLabelEl.style.transition = 'opacity 0.2s'
  svgEl.appendChild(locLabelEl)
}

function nearestHex(lat, lng) {
  let best = null, bestD = Infinity
  for (const h of hexEls) {
    const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2
    if (d < bestD) { bestD = d; best = h }
  }
  return best
}

export function resetNeighborhoodMap() {
  for (const h of hexEls) {
    h.poly.setAttribute('fill', cssVar('--map-hex-fill', '#d6d3cc'))
    h.poly.removeAttribute('filter')
  }
  for (const text of landmarkEls) {
    applyMapLabelStyle(text, '--map-label', '--map-label-stroke')
  }
  if (locLabelEl) applyMapLabelStyle(locLabelEl, '--map-label-active', '--map-label-active-stroke')
  if (dotEl) {
    dotEl.setAttribute('fill', cssVar('--map-dot-fill', '#ccc'))
    dotEl.setAttribute('stroke', cssVar('--map-dot-stroke', '#fff'))
  }
  if (pathEl) pathEl.setAttribute('points', '')
  if (dotEl)  dotEl.setAttribute('opacity', '0')
  if (locLabelEl) locLabelEl.setAttribute('opacity', '0')
  prevCurrentHex = null
  prevVisitedSet = new Set()
}

export function refreshNeighborhoodMapTheme() {
  if (!svgEl) return
  // reset diff state so next updateNeighborhoodMap repaints correctly
  prevCurrentHex = null
  prevVisitedSet = new Set()
  for (const h of hexEls) {
    h.poly.setAttribute('fill', cssVar('--map-hex-fill', '#d6d3cc'))
    h.poly.setAttribute('stroke', cssVar('--map-hex-stroke', '#f5f4f0'))
  }
  for (const text of landmarkEls) {
    applyMapLabelStyle(text, '--map-label', '--map-label-stroke')
  }
  if (locLabelEl) applyMapLabelStyle(locLabelEl, '--map-label-active', '--map-label-active-stroke')
  if (dotEl) {
    dotEl.setAttribute('fill', cssVar('--map-dot-fill', '#ccc'))
    dotEl.setAttribute('stroke', cssVar('--map-dot-stroke', '#fff'))
  }
}

export function updateNeighborhoodMap(persona, hour, accentColor = '') {
  if (!svgEl || !hexEls.length) return

  const accent = persona.color

  const visitedSet = new Set()
  const pathPoints = []

  for (let h = 0; h <= hour; h++) {
    const s = persona.schedule[h]
    const hex = nearestHex(s.lat, s.lng)
    if (!hex) continue
    if (h < hour) visitedSet.add(hex)
    pathPoints.push(`${hex.cx.toFixed(1)},${hex.cy.toFixed(1)}`)
  }

  const currentSched = persona.schedule[hour]
  const currentHex = nearestHex(currentSched.lat, currentSched.lng)

  for (const h of hexEls) {
    const wasCurrentHex = h === prevCurrentHex
    const isCurrentHex  = h === currentHex
    const wasVisited    = prevVisitedSet.has(h)
    const isVisited     = visitedSet.has(h)

    if (isCurrentHex && !wasCurrentHex) {
      h.poly.setAttribute('fill', accent)
      h.poly.setAttribute('filter', `drop-shadow(0 0 4px ${accent}88)`)
    } else if (wasCurrentHex && !isCurrentHex) {
      h.poly.setAttribute('fill', isVisited ? accent + '40' : cssVar('--map-hex-fill', '#d6d3cc'))
      h.poly.removeAttribute('filter')
    } else if (isVisited && !wasVisited) {
      h.poly.setAttribute('fill', accent + '40')
      h.poly.removeAttribute('filter')
    } else if (!isVisited && wasVisited && !isCurrentHex) {
      h.poly.setAttribute('fill', cssVar('--map-hex-fill', '#d6d3cc'))
      h.poly.removeAttribute('filter')
    }
  }

  prevCurrentHex = currentHex
  prevVisitedSet = visitedSet

  // trail
  if (pathEl) {
    pathEl.setAttribute('points', pathPoints.join(' '))
    pathEl.setAttribute('stroke', accent)
  }

  // dot at current hex center
  if (dotEl && currentHex) {
    dotEl.setAttribute('cx', currentHex.cx.toFixed(1))
    dotEl.setAttribute('cy', currentHex.cy.toFixed(1))
    dotEl.setAttribute('fill', accent)
    dotEl.setAttribute('opacity', '1')
    dotEl.setAttribute('filter', `drop-shadow(0 0 3px ${accent})`)
  }

  // dynamic label: short loc name above the dot
  if (locLabelEl && currentHex) {
    const loc = persona.schedule[hour]?.loc || ''
    // trim suffixes like " — Walking" for brevity
    const shortLoc = loc.replace(/\s*[—–-].*$/, '').trim()
    locLabelEl.textContent = shortLoc
    locLabelEl.setAttribute('x', currentHex.cx.toFixed(1))
    locLabelEl.setAttribute('y', (currentHex.cy - 12).toFixed(1))
    locLabelEl.setAttribute('opacity', '1')
  }
}
