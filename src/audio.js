export let audioCtx = null
export let analyserNode = null
let currentSoundNodes = []

export function getAudioCtx() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContext()
    analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 2048
    analyserNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function stopAllSounds() {
  currentSoundNodes.forEach(node => {
    try {
      node.stop(0)
    } catch (e) {}
  })
  currentSoundNodes = []
}

export function playSoundType(type, db) {
  const ctx = getAudioCtx()
  if (!ctx) return
  
  stopAllSounds()

  const masterGain = ctx.createGain()
  masterGain.connect(analyserNode)

  if (type === 'flatline') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = 100
    g.gain.value = 0.018
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 4)
    currentSoundNodes.push(osc)
    return
  }

  const gainValue = Math.max(0.05, Math.min(0.3, (db - 40) / 60))
  masterGain.gain.setValueAtTime(0, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.3)
  masterGain.gain.linearRampToValueAtTime(gainValue * 0.8, ctx.currentTime + 3.5)
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4)

  const now = ctx.currentTime
  const end = now + 4

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
    case 'busking': {
      const voicing = [164, 196, 247, 330, 392]
      for (let strum = 0; strum < 3; strum++) {
        voicing.forEach((f, i) => {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = f
          const env = ctx.createGain()
          env.gain.setValueAtTime(0, now + strum * 1 + i * 0.05)
          env.gain.linearRampToValueAtTime(0.12, now + strum * 1 + i * 0.05 + 0.05)
          env.gain.exponentialRampToValueAtTime(0.01, now + strum * 1 + i * 0.05 + 0.6)
          osc.connect(env)
          env.connect(masterGain)
          osc.start(now + strum * 1 + i * 0.05)
          osc.stop(now + strum * 1 + i * 0.05 + 0.6)
          currentSoundNodes.push(osc, env)
        })
      }
      break
    }
  }
}
