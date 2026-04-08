import { state } from './state.js'
import { getSoundColor } from './personas.js'
import { pickRandomClipUrl, playClipConcurrent } from './audio.js'
import { clearDogMarkers, spawnDogMarker } from './neighborhoodmap.js'

const DOG_BOROUGH = 1 // Manhattan

// geographic bounds (covers Battery Park to UWS/UES)
const LAT_MIN = 40.697, LAT_MAX = 40.786
const LNG_MIN = -74.023, LNG_MAX = -73.937

// simplified Manhattan outline polygon [lat, lng]
const MANHATTAN_POLY = [
  [40.700, -74.017],
  [40.708, -74.020],
  [40.718, -74.016],
  [40.728, -74.012],
  [40.736, -74.010],
  [40.746, -74.005],
  [40.756, -74.001],
  [40.764, -73.998],
  [40.774, -73.993],
  [40.782, -73.988],
  [40.785, -73.975],
  [40.785, -73.947],
  [40.778, -73.942],
  [40.770, -73.945],
  [40.758, -73.951],
  [40.748, -73.957],
  [40.742, -73.968],
  [40.730, -73.974],
  [40.720, -73.979],
  [40.710, -73.983],
  [40.702, -73.990],
  [40.700, -74.017],
]

const MARKER_VARIANTS = [
  'assets/dog-marker-1.svg',
  'assets/dog-marker-2.svg',
  'assets/dog-marker-3.svg',
  'assets/dog-marker-4.svg',
  'assets/dog-marker-5.svg',
  'assets/dog-mode-marker-6.svg',
  'assets/dog-mode-marker-7.svg',
  'assets/dog-mode-marker-8.svg',
  'assets/dog-mode-marker-9.svg',
  'assets/dog-mode-marker-10.svg',
  'assets/dog-mode-marker-11.svg',
  'assets/dog-mode-marker-12.svg',
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randBetween(min, max) {
  return min + Math.random() * (max - min)
}

// ray-casting point-in-polygon
function inPolygon(lat, lng, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function isSafePoint(lat, lng) {
  if (!inPolygon(lat, lng, MANHATTAN_POLY)) return false

  // small inner-buffer via neighbor checks to avoid edges/water
  const eps = 0.0014
  return (
    inPolygon(lat + eps, lng, MANHATTAN_POLY) &&
    inPolygon(lat - eps, lng, MANHATTAN_POLY) &&
    inPolygon(lat, lng + eps, MANHATTAN_POLY) &&
    inPolygon(lat, lng - eps, MANHATTAN_POLY)
  )
}

function samplePointBiased() {
  // biased toward WSP + lower Manhattan
  // mixture: 60% WSP-ish, 30% FiDi-ish, 10% uniform
  const r = Math.random()
  if (r < 0.6) {
    return {
      lat: 40.731 + randBetween(-0.010, 0.010),
      lng: -74.000 + randBetween(-0.012, 0.012),
    }
  }
  if (r < 0.9) {
    return {
      lat: 40.715 + randBetween(-0.012, 0.012),
      lng: -74.010 + randBetween(-0.010, 0.010),
    }
  }
  return {
    lat: randBetween(LAT_MIN, LAT_MAX),
    lng: randBetween(LNG_MIN, LNG_MAX),
  }
}

function pickDogMarkerHref(recent) {
  if (!MARKER_VARIANTS.length) return null

  // Exclude last 5 used markers from pool
  const recentSet = new Set(recent.slice(-5))
  const available = MARKER_VARIANTS.filter(h => !recentSet.has(h))

  // Fallback if all variants exhausted (rare)
  if (available.length === 0) {
    return MARKER_VARIANTS[Math.floor(Math.random() * MARKER_VARIANTS.length)]
  }

  return available[Math.floor(Math.random() * available.length)]
}

let runningToken = 0
let activeSources = []
let activeMarkers = []
let activeMarkerTimers = []
let recentMarkerHrefs = []

export function getDogModeColor() {
  return getSoundColor('dog') || '#55efc4'
}

export async function startDogMode() {
  stopDogMode() // hard reset (also bumps token)
  const myToken = runningToken

  clearDogMarkers()
  activeSources = []
  activeMarkers = []
  activeMarkerTimers = []
  recentMarkerHrefs = []

  const channels = Math.max(1, Math.floor(state.dogMode?.channels || 5))
  const markerCap = Math.max(1, Math.floor(state.dogMode?.markerCap || 40))

  const spawnVisualMarker = () => {
    // pick spawn point
    let lat = null, lng = null
    for (let tries = 0; tries < 80; tries++) {
      const p = samplePointBiased()
      if (isSafePoint(p.lat, p.lng)) {
        lat = p.lat
        lng = p.lng
        break
      }
    }
    if (lat === null || lng === null) return

    const markerHref = pickDogMarkerHref(recentMarkerHrefs)
    if (!markerHref) return

    recentMarkerHrefs.push(markerHref)
    if (recentMarkerHrefs.length > 10) recentMarkerHrefs = recentMarkerHrefs.slice(-10)

    const marker = spawnDogMarker(lat, lng, markerHref, { size: 34 })
    if (!marker) return

    activeMarkers.push(marker)
    while (activeMarkers.length > markerCap) {
      const oldest = activeMarkers.shift()
      try { oldest?.remove?.() } catch (e) {}
    }

    const lingerMs = randBetween(4500, 6000)
    const tid = window.setTimeout(() => {
      activeMarkerTimers = activeMarkerTimers.filter(id => id !== tid)
      activeMarkers = activeMarkers.filter(m => m !== marker)
      try { marker.remove?.() } catch (e) {}
    }, lingerMs)
    activeMarkerTimers.push(tid)
  }

  const loopChannel = async () => {
    while (myToken === runningToken) {
      await sleep(randBetween(500, 1200))
      if (myToken !== runningToken) return

      const url = pickRandomClipUrl('dog', { borough: DOG_BOROUGH })
      if (!url) {
        // no clips available, just idle
        await sleep(800)
        continue
      }

      const durationSeconds = randBetween(2.0, 3.0)
      const clip = await playClipConcurrent(url, 75, { durationSeconds })
      if (!clip || myToken !== runningToken) {
        try { clip?.stop?.() } catch (e) {}
        continue
      }
      activeSources.push(clip)
    }
  }

  const loopVisuals = async () => {
    while (myToken === runningToken) {
      // Visuals are intentionally slower and independent from bark timing.
      await sleep(randBetween(600, 1000))
      if (myToken !== runningToken) return
      spawnVisualMarker()
    }
  }

  for (let i = 0; i < channels; i++) {
    loopChannel().catch(() => {})
  }
  loopVisuals().catch(() => {})
}

export function stopDogMode() {
  runningToken += 1
  activeSources.forEach(s => {
    try { s?.stop?.() } catch (e) {}
  })
  activeSources = []

  activeMarkers.forEach(m => {
    try { m?.remove?.() } catch (e) {}
  })
  activeMarkers = []
  activeMarkerTimers.forEach(id => {
    try { window.clearTimeout(id) } catch (e) {}
  })
  activeMarkerTimers = []
  recentMarkerHrefs = []
  clearDogMarkers()
}
