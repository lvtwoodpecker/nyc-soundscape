let canvas = null
let ctx = null
let animationId = null
let waveformActive = false
let currentColor = '#6b5fd4'

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function setWaveformActive(active, color) {
  waveformActive = active
  if (color) currentColor = color
}

export function resizeWaveform() {
  canvas = document.getElementById('waveform-canvas')
  if (!canvas) return
  ctx = canvas.getContext('2d')
  canvas.width = canvas.offsetWidth * window.devicePixelRatio
  canvas.height = canvas.offsetHeight * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

export function drawWaveform(analyserNode) {
  if (!canvas || !ctx) return
  if (animationId) cancelAnimationFrame(animationId)

  const draw = () => {
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    ctx.fillStyle = cssVar('--waveform-bg', '#ededea')
    ctx.fillRect(0, 0, w, h)

    if (waveformActive && analyserNode && analyserNode.context.state === 'running') {
      const bufLen = analyserNode.frequencyBinCount
      const freqData = new Uint8Array(bufLen)
      analyserNode.getByteFrequencyData(freqData)

      const barCount = Math.min(bufLen, 80)
      const barW = w / barCount
      const step = Math.floor(bufLen / barCount)
      const bottomMargin = 2

      for (let i = 0; i < barCount; i++) {
        const val = freqData[i * step] / 255
        const barH = val * (h - bottomMargin) * 0.92
        const x = i * barW
        const grad = ctx.createLinearGradient(0, h - bottomMargin, 0, h - bottomMargin - barH)
        grad.addColorStop(0, currentColor + '40')
        grad.addColorStop(1, currentColor + 'cc')
        ctx.fillStyle = grad
        ctx.fillRect(x + 0.5, h - bottomMargin - barH, barW - 1, barH)
      }
    } else {
      // idle: flat line at center
      const midY = h / 2
      ctx.strokeStyle = currentColor + '44'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()
    }

    animationId = requestAnimationFrame(draw)
  }

  draw()
}
