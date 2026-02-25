let canvas = null
let ctx = null
let animationId = null

export function resizeWaveform() {
  canvas = document.getElementById('waveform-canvas')
  if (!canvas) return
  ctx = canvas.getContext('2d')
  canvas.width = canvas.offsetWidth * window.devicePixelRatio
  canvas.height = canvas.offsetHeight * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

export function drawWaveform(analyserNode, personaColor) {
  if (!canvas || !ctx) return

  if (animationId) cancelAnimationFrame(animationId)

  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  const midY = h / 2

  const draw = () => {
    ctx.fillStyle = '#12152a'
    ctx.fillRect(0, 0, w, h)

    if (analyserNode && analyserNode.context.state === 'running') {
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount)
      analyserNode.getByteTimeDomainData(dataArray)

      ctx.strokeStyle = personaColor || '#a29bfe'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < dataArray.length; i++) {
        const x = (i / dataArray.length) * w
        const y = midY - (dataArray[i] / 128 - 1) * (h / 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.shadowColor = personaColor || '#a29bfe'
      ctx.shadowBlur = 8
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.stroke()
      ctx.shadowColor = 'transparent'
    } else {
      const now = Date.now() / 1000
      const freqs = [3, 7, 13]
      const phases = freqs.map((f, i) => now * f * (1 + i * 0.1))

      ctx.strokeStyle = personaColor || '#a29bfe'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < w; i++) {
        let y = 0
        freqs.forEach((f, idx) => {
          y += Math.sin((i / w) * f * Math.PI * 2 + phases[idx]) * 0.3
        })
        const py = midY + y * (h / 3)
        if (i === 0) ctx.moveTo(i, py)
        else ctx.lineTo(i, py)
      }
      ctx.stroke()

      ctx.shadowColor = personaColor || '#a29bfe'
      ctx.shadowBlur = 6
      ctx.stroke()
      ctx.shadowColor = 'transparent'
    }

    animationId = requestAnimationFrame(draw)
  }

  draw()
}
