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

let clipPool = {}       // coarse type -> { all: [url], 1: [url], 3: [url], 4: [url] }
const bufferCache = new Map()
const MIN_PLAY_SECONDS = 5
const MAX_PLAY_SECONDS = 7

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

function pickDeterministicUrl(urls, key) {
  if (!urls?.length) return null
  if (!key) return urls[0]
  const idx = hashString(String(key)) % urls.length
  return urls[idx]
}

export async function loadClipIndex() {
  try {
    const res = await fetch('data/processed/clip-index.json')
    const index = await res.json()
    for (const [coarse, fineClasses] of Object.entries(COARSE_TO_FINE)) {
      const pool = { all: [] }
      for (const f of fineClasses) {
        for (const clip of (index[f] || [])) {
          const url = clip.url || clip
          const b = clip.borough
          if (b) {
            if (!pool[b]) pool[b] = []
            pool[b].push(url)
          }
          pool.all.push(url)
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

  // try real clip, prefer borough-matched, fall back to any, then synthesis
  const pool = clipPool[type]
  if (pool) {
    const urls = (borough && pool[borough]?.length) ? pool[borough] : pool.all
    if (urls?.length > 0) {
      const url = pickDeterministicUrl(urls, clipKey)
      if (!url) {
        playSynth(type, db, clipKey)
        return
      }
      playClip(url, db, clipKey, options, requestToken).catch(() => playSynth(type, db, clipKey))
      return
    }
  }

  playSynth(type, db, clipKey)
}

function playSynth(type, db, durationKey = '') {
  const ctx = getAudioCtx()
  stopAllSounds(false)
  emitPlaybackState(true)
  const playDuration = pickPlayDuration(MAX_PLAY_SECONDS, durationKey)
  schedulePlaybackStop(Math.max(500, Math.round(playDuration * 1000) + 60))

  const masterGain = ctx.createGain()
  masterGain.connect(analyserNode)

  const gainValue = Math.max(0.05, Math.min(0.3, (db - 40) / 60))
  const end = ctx.currentTime + playDuration
  const release = 0.2
  const sustainEnd = Math.max(ctx.currentTime + 0.3, end - release)
  masterGain.gain.setValueAtTime(0, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.3)
  masterGain.gain.setValueAtTime(gainValue * 0.85, sustainEnd)
  masterGain.gain.linearRampToValueAtTime(0, end)

  const now = ctx.currentTime

  switch (type) {
    case 'engine': {
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc2.type = 'sawtooth'
      osc1.frequency.value = 55
      osc2.frequency.value = 61
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 5
      lfoGain.gain.value = 10
      lfo.connect(lfoGain)
      lfoGain.connect(osc1.frequency)
      osc1.connect(masterGain)
      osc2.connect(masterGain)
      lfo.start()
      osc1.start()
      osc2.start()
      osc1.stop(end)
      osc2.stop(end)
      lfo.stop(end)
      currentSoundNodes.push(osc1, osc2, lfo)
      break
    }
    case 'machinery': {
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = 120 + i * 8
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.1, now + i * 0.15)
        env.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.08)
        osc.connect(env)
        env.connect(masterGain)
        osc.start(now + i * 0.15)
        osc.stop(now + i * 0.15 + 0.08)
        currentSoundNodes.push(osc, env)
      }
      break
    }
    case 'impact': {
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(200, now + i * 0.4)
        osc.frequency.linearRampToValueAtTime(40, now + i * 0.4 + 0.1)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.2, now + i * 0.4)
        env.gain.linearRampToValueAtTime(0, now + i * 0.4 + 0.1)
        osc.connect(env)
        env.connect(masterGain)
        osc.start(now + i * 0.4)
        osc.stop(now + i * 0.4 + 0.1)
        currentSoundNodes.push(osc, env)
      }
      break
    }
    case 'saw': {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1600, now)
      osc.frequency.linearRampToValueAtTime(2400, now + 2)
      osc.frequency.linearRampToValueAtTime(800, now + 4)
      osc.connect(masterGain)
      osc.start()
      osc.stop(end)
      currentSoundNodes.push(osc)
      break
    }
    case 'alert': {
      for (let t = 0; t < 8; t++) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = t % 2 === 0 ? 880 : 660
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.1, now + t * 0.25)
        env.gain.linearRampToValueAtTime(0, now + t * 0.25 + 0.2)
        osc.connect(env)
        env.connect(masterGain)
        osc.start(now + t * 0.25)
        osc.stop(now + t * 0.25 + 0.2)
        currentSoundNodes.push(osc, env)
      }
      break
    }
    case 'music': {
      const freqs = [261.6, 329.6, 392, 493.9]
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = f
        const env = ctx.createGain()
        env.gain.setValueAtTime(0, now + i * 0.05)
        env.gain.linearRampToValueAtTime(0.08, now + i * 0.05 + 0.05)
        env.gain.linearRampToValueAtTime(0, now + 3.5)
        osc.connect(env)
        env.connect(masterGain)
        osc.start(now + i * 0.05)
        osc.stop(end)
        currentSoundNodes.push(osc, env)
      })
      break
    }
    case 'voice': {
      const formants = [200, 450, 800, 1200]
      formants.forEach((f, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = f
        const noiseOsc = ctx.createOscillator()
        noiseOsc.frequency.setValueAtTime(f, now)
        noiseOsc.frequency.linearRampToValueAtTime(f * 1.1, now + 0.5)
        const env = ctx.createGain()
        env.gain.value = 0.04
        osc.connect(env)
        noiseOsc.connect(env)
        env.connect(masterGain)
        osc.start()
        noiseOsc.start()
        osc.stop(end)
        noiseOsc.stop(end)
        currentSoundNodes.push(osc, noiseOsc, env)
      })
      break
    }
    case 'dog': {
      for (let b = 0; b < 3; b++) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(380, now + b * 0.3)
        osc.frequency.linearRampToValueAtTime(260, now + b * 0.3 + 0.022)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.1, now + b * 0.3)
        env.gain.linearRampToValueAtTime(0, now + b * 0.3 + 0.022)
        osc.connect(env)
        env.connect(masterGain)
        osc.start(now + b * 0.3)
        osc.stop(now + b * 0.3 + 0.022)
        currentSoundNodes.push(osc, env)
      }
      break
    }
  }
}
