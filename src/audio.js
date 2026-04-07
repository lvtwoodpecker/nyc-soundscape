export let audioCtx = null
export let analyserNode = null
let masterVolumeNode = null
let currentSoundNodes = []
let playbackState = false
let playbackStopTimer = null
let clipRequestToken = 0
const playbackListeners = new Set()

function emitPlaybackState(isPlaying) {
  playbackState = isPlaying
  playbackListeners.forEach(cb => {
    try { cb(isPlaying) } catch (e) {}
  })
}

function schedulePlaybackStop(ms) {
  if (playbackStopTimer) clearTimeout(playbackStopTimer)
  playbackStopTimer = setTimeout(() => {
    emitPlaybackState(false)
  }, ms)
}

export function onPlaybackStateChange(callback) {
  if (typeof callback !== 'function') return () => {}
  playbackListeners.add(callback)
  callback(playbackState)
  return () => {
    playbackListeners.delete(callback)
  }
}

// coarse class -> fine-grained clip classes in clip-index.json (SONYC names)
const COARSE_TO_FINE = {
  engine:    ['small-sounding-engine', 'medium-sounding-engine', 'large-sounding-engine'],
  machinery: ['rock-drill', 'jackhammer', 'hoe-ram', 'pile-driver'],
  impact:    ['non-machinery-impact'],
  saw:       ['chainsaw', 'small-medium-rotating-saw', 'large-rotating-saw'],
  alert:     ['car-horn', 'car-alarm', 'siren', 'reverse-beeper'],
  music:     ['stationary-music', 'mobile-music', 'ice-cream-truck'],
  voice:     ['person-or-small-group-talking', 'person-or-small-group-shouting', 'large-crowd', 'amplified-speech'],
  dog:       ['dog-barking-whining'],
}

let clipPool = {}       // coarse type -> { all: [clip], 1: [clip], 3: [clip], 4: [clip], byHour: { 0: { all: [clip], 1:[clip]... } } }
const bufferCache = new Map()
const MIN_PLAY_SECONDS = 5
const MAX_PLAY_SECONDS = 7
const MAX_NEAREST_CANDIDATES = 5

function randBetween(min, max) {
  return min + Math.random() * (max - min)
}

function pickPlayDuration(maxAvailableSeconds = MAX_PLAY_SECONDS, key = '') {
  const hash = key ? hashString(String(key)) : 0
  const unit = key ? (hash / 0xffffffff) : 0.5
  const target = MIN_PLAY_SECONDS + unit * (MAX_PLAY_SECONDS - MIN_PLAY_SECONDS)
  return Math.max(0.8, Math.min(maxAvailableSeconds, target))
}

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickDeterministic(items, key) {
  if (!items?.length) return null
  if (!key) return items[0]
  const idx = hashString(String(key)) % items.length
  return items[idx]
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => d * Math.PI / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

let clipAssignments = {}  // "persona:hour" -> { url, type }

export async function loadClipIndex() {
  try {
    const [assignRes, indexRes] = await Promise.all([
      fetch('data/processed/clip-assignments.json'),
      fetch('data/processed/clip-index.json'),
    ])
    clipAssignments = assignRes.ok ? await assignRes.json() : {}
    const index = await indexRes.json()
    for (const [coarse, fineClasses] of Object.entries(COARSE_TO_FINE)) {
      const pool = { all: [], byHour: {} }
      for (const f of fineClasses) {
        for (const clip of (index[f] || [])) {
          const clipObj = (typeof clip === 'object' && clip !== null)
            ? {
                url: clip.url,
                borough: clip.borough,
                hour: clip.hour,
                lat: clip.lat,
                lng: clip.lng,
              }
            : { url: clip }
          const b = clipObj.borough
          const h = clipObj.hour

          if (h !== undefined && h !== null) {
            const hk = String(h)
            if (!pool.byHour[hk]) pool.byHour[hk] = { all: [] }
            if (b) {
              if (!pool.byHour[hk][b]) pool.byHour[hk][b] = []
              pool.byHour[hk][b].push(clipObj)
            }
            pool.byHour[hk].all.push(clipObj)
          }

          if (b) {
            if (!pool[b]) pool[b] = []
            pool[b].push(clipObj)
          }
          pool.all.push(clipObj)
        }
      }
      clipPool[coarse] = pool
    }
  } catch (e) {
    console.warn('clip-index not loaded, using synthesis')
  }
}

export function getAudioCtx() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContext()
    analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 2048
    masterVolumeNode = audioCtx.createGain()
    masterVolumeNode.gain.value = 0.7
    analyserNode.connect(masterVolumeNode)
    masterVolumeNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function setMasterVolume(val) {
  if (masterVolumeNode) masterVolumeNode.gain.value = val
}

export async function pauseAudio() {
  if (!audioCtx) return
  if (audioCtx.state === 'running') {
    await audioCtx.suspend()
  }
}

export async function resumeAudio() {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}

export function isAudioPaused() {
  return !!audioCtx && audioCtx.state === 'suspended'
}

export function isAudioPlaying() {
  return playbackState
}

export function stopAllSounds(emitIdle = true) {
  clipRequestToken += 1
  currentSoundNodes.forEach(node => {
    try { node.stop(0) } catch (e) {}
  })
  currentSoundNodes = []
  if (playbackStopTimer) clearTimeout(playbackStopTimer)
  if (emitIdle) emitPlaybackState(false)
}

async function playClip(url, db, durationKey = '', options = {}, requestToken = 0) {
  const ctx = getAudioCtx()
  let buffer = bufferCache.get(url)
  if (!buffer) {
    const res = await fetch(url)
    const raw = await res.arrayBuffer()
    buffer = await ctx.decodeAudioData(raw)
    bufferCache.set(url, buffer)
  }

  if (requestToken !== clipRequestToken) return

  stopAllSounds(false)

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gainValue = Math.max(0.3, Math.min(0.9, 0.6 + (db - 70) / 200))
  const fullLength = Boolean(options.fullLength)
  const playDuration = fullLength
    ? Math.max(0.8, buffer.duration || MAX_PLAY_SECONDS)
    : pickPlayDuration(buffer.duration || MAX_PLAY_SECONDS, durationKey)
  const attack = 0.2
  const release = 0.18
  const endTime = ctx.currentTime + playDuration
  const sustainEnd = Math.max(ctx.currentTime + attack, endTime - release)

  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(0, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + attack)
  masterGain.gain.setValueAtTime(gainValue * 0.92, sustainEnd)
  masterGain.gain.linearRampToValueAtTime(0, endTime)

  source.connect(masterGain)
  masterGain.connect(analyserNode)
  source.start()
  source.stop(endTime)
  currentSoundNodes.push(source)
  emitPlaybackState(true)
  schedulePlaybackStop(Math.max(500, Math.round(playDuration * 1000) + 60))
}

export function pickRandomClipUrl(type, options = {}) {
  const pool = clipPool?.[type]
  if (!pool) return null
  const borough = options?.borough
  const list = (borough !== undefined && borough !== null)
    ? (pool[borough] || pool[String(borough)] || null)
    : null
  const items = (list && list.length) ? list : pool.all
  if (!items?.length) return null
  const idx = Math.floor(Math.random() * items.length)
  const picked = items[idx]
  return picked?.url || null
}

export async function playClipConcurrent(url, db, options = {}) {
  const ctx = getAudioCtx()
  if (!ctx) return null

  let buffer = bufferCache.get(url)
  if (!buffer) {
    const res = await fetch(url)
    const raw = await res.arrayBuffer()
    buffer = await ctx.decodeAudioData(raw)
    bufferCache.set(url, buffer)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const targetDuration = Number.isFinite(options?.durationSeconds)
    ? Math.max(0.2, options.durationSeconds)
    : randBetween(2.0, 3.0)

  const gainValue = Number.isFinite(options?.gain)
    ? options.gain
    : Math.max(0.25, Math.min(0.95, 0.58 + (db - 70) / 220))

  const attack = 0.04
  const release = 0.12
  const playDuration = Math.min(targetDuration, buffer.duration || targetDuration)
  const endTime = ctx.currentTime + playDuration
  const sustainEnd = Math.max(ctx.currentTime + attack, endTime - release)

  const g = ctx.createGain()
  g.gain.setValueAtTime(0, ctx.currentTime)
  g.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + attack)
  g.gain.setValueAtTime(gainValue * 0.92, sustainEnd)
  g.gain.linearRampToValueAtTime(0, endTime)

  source.connect(g)
  g.connect(analyserNode)
  source.start()
  source.stop(endTime)

  let endedResolve
  const ended = new Promise(resolve => { endedResolve = resolve })
  source.addEventListener('ended', () => endedResolve?.(), { once: true })

  const stop = () => {
    try { source.stop(0) } catch (e) {}
  }

  return { source, ended, stop, durationSeconds: playDuration }
}

export function playSoundType(type, db, borough, clipKey = '', options = {}) {
  const ctx = getAudioCtx()
  if (!ctx) return
  const requestToken = ++clipRequestToken

  if (type === 'flatline') {
    if (requestToken !== clipRequestToken) return
    stopAllSounds(false)
    const playDuration = pickPlayDuration(MAX_PLAY_SECONDS, clipKey || `${type}:${borough || 'x'}`)
    const endTime = ctx.currentTime + playDuration
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = 100
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 0.18)
    g.gain.setValueAtTime(0.016, Math.max(ctx.currentTime + 0.18, endTime - 0.16))
    g.gain.linearRampToValueAtTime(0, endTime)
    osc.connect(g)
    g.connect(masterVolumeNode || ctx.destination)
    osc.start()
    osc.stop(endTime)
    currentSoundNodes.push(osc)
    emitPlaybackState(true)
    schedulePlaybackStop(Math.max(500, Math.round(playDuration * 1000) + 60))
    return
  }

  // pre-assigned clip takes priority — guarantees no duplicates across all 120 persona-hours
  // clipKey format is "persona:hour:borough:type"; assignment key is "persona:hour"
  const assignKey = clipKey ? clipKey.split(':').slice(0, 2).join(':') : null
  if (assignKey && clipAssignments[assignKey]?.type === type) {
    const { url } = clipAssignments[assignKey]
    playClip(url, db, clipKey, options, requestToken).catch(err => {
      console.error(`[audio] pre-assigned clip fetch failed: ${url}`, err)
    })
    return
  }

  // require both ±2h match and borough match — no silent fallback
  const pool = clipPool[type]
  if (pool) {
    const hour = options?.hour
    let candidates = null
    if (hour !== undefined && hour !== null) {
      const windowByUrl = new Map()
      for (const delta of [0, 1, -1, 2, -2]) {
        const h2 = ((hour + delta) % 24 + 24) % 24
        const hp = pool.byHour?.[String(h2)]
        if (!hp) continue
        hp[borough]?.forEach(c => {
          if (c?.url && !windowByUrl.has(c.url)) windowByUrl.set(c.url, c)
        })
      }
      candidates = windowByUrl.size ? [...windowByUrl.values()] : null
    }

    if (!candidates?.length) {
      console.error(`[audio] no clip for type=${type} borough=${borough} hour=${options?.hour} key=${clipKey} — add clips to cover this`)
      return
    }

    const hasPoint = Number.isFinite(options?.lat) && Number.isFinite(options?.lng)
    if (hasPoint) {
      candidates = [...candidates]
        .sort((a, b) => {
          const da = (Number.isFinite(a?.lat) && Number.isFinite(a?.lng))
            ? haversineMeters(options.lat, options.lng, a.lat, a.lng)
            : Number.POSITIVE_INFINITY
          const db = (Number.isFinite(b?.lat) && Number.isFinite(b?.lng))
            ? haversineMeters(options.lat, options.lng, b.lat, b.lng)
            : Number.POSITIVE_INFINITY
          if (da !== db) return da - db
          return String(a?.url || '').localeCompare(String(b?.url || ''))
        })
      candidates = candidates.slice(0, Math.min(MAX_NEAREST_CANDIDATES, candidates.length))
    }

    const picked = hasPoint
      ? candidates[0]
      : pickDeterministic(candidates, clipKey)
    const url = picked?.url
    if (!url) {
      console.error(`[audio] selected clip missing URL for type=${type} hour=${options?.hour}`)
      return
    }
    playClip(url, db, clipKey, options, requestToken).catch(err => {
      console.error(`[audio] clip fetch failed: ${url}`, err)
    })
    return
  }

  console.error(`[audio] unknown type=${type} — no pool loaded`)
}
