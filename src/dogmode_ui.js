import { getDogModeColor } from './dogmode.js'
import { describeArc } from './clock.js'

const DOG_TEXT = {
  originals: new Map(),
  active: false,
}

const EXIT_MOUNT = {
  parent: null,
  nextSibling: null,
  styleAttr: null,
}

function mountExitButtonInStory() {
  const exitBtn = document.getElementById('dog-mode-exit')
  const story = document.getElementById('journey-desc-text')
  if (!exitBtn || !story) return

  if (!EXIT_MOUNT.parent) {
    EXIT_MOUNT.parent = exitBtn.parentElement
    EXIT_MOUNT.nextSibling = exitBtn.nextSibling
    EXIT_MOUNT.styleAttr = exitBtn.getAttribute('style')
  }

  // Replace transcript area content with the exit button.
  story.innerHTML = ''
  story.appendChild(exitBtn)

  // Override the default absolute positioning so it behaves like content.
  exitBtn.style.position = 'static'
  exitBtn.style.left = ''
  exitBtn.style.right = ''
  exitBtn.style.bottom = ''
  exitBtn.style.width = '100%'
  exitBtn.style.height = '44px'
}

function restoreExitButtonMount() {
  const exitBtn = document.getElementById('dog-mode-exit')
  if (!exitBtn || !EXIT_MOUNT.parent) return

  if (EXIT_MOUNT.nextSibling && EXIT_MOUNT.nextSibling.parentNode === EXIT_MOUNT.parent) {
    EXIT_MOUNT.parent.insertBefore(exitBtn, EXIT_MOUNT.nextSibling)
  } else {
    EXIT_MOUNT.parent.appendChild(exitBtn)
  }

  if (EXIT_MOUNT.styleAttr == null) exitBtn.removeAttribute('style')
  else exitBtn.setAttribute('style', EXIT_MOUNT.styleAttr)

  EXIT_MOUNT.parent = null
  EXIT_MOUNT.nextSibling = null
  EXIT_MOUNT.styleAttr = null
}

function dogDbFactor(db) {
  if (!Number.isFinite(db) || db <= 0) return 0
  const low = 58
  const high = 84
  const norm = (db - low) / (high - low)
  const clamped = Math.max(0, Math.min(1, norm))
  const curved = Math.pow(clamped, 0.78)
  return 0.22 + 0.78 * curved
}

export function renderDogRing({ persona = null, selectedHour = 0, hourlyStats = null } = {}) {
  const svg = document.getElementById('dog-ring')
  if (!svg) return

  const c = getDogModeColor()
  const R_INNER = 168
  const R_OUTER = 228

  svg.innerHTML = ''

  // faint guide ring
  const guide = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  guide.setAttribute('r', R_OUTER)
  guide.setAttribute('cx', 0)
  guide.setAttribute('cy', 0)
  guide.setAttribute('fill', 'none')
  guide.setAttribute('stroke', c)
  guide.setAttribute('stroke-opacity', '0.15')
  guide.setAttribute('stroke-width', '1')
  svg.appendChild(guide)

  for (let h = 0; h < 24; h++) {
    let db = 0
    let hasData = false
    const hasPersonaData = Boolean(persona && hourlyStats?.by_borough)

    if (hasPersonaData) {
      const hourEntry = persona.schedule?.[h]
      const b = hourEntry ? hourlyStats.by_borough[String(hourEntry.borough)] : null
      const hData = b?.[String(h)]
      if (hData && Number.isFinite(hData.db) && hData.db > 0) {
        db = hData.db
        hasData = true
      }
    }

    const isSelected = h === selectedHour
    const factor = hasData ? dogDbFactor(db) : 0.78
    const outerR = hasPersonaData
      ? (hasData ? Math.max(R_INNER + 4, R_INNER + factor * (R_OUTER - R_INNER)) : (R_INNER + 2))
      : Math.max(R_INNER + 4, R_INNER + factor * (R_OUTER - R_INNER))

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', describeArc(h, R_INNER, outerR))
    path.setAttribute('fill', c)
    path.setAttribute('opacity', isSelected ? '0.98' : hasPersonaData ? (hasData ? '0.62' : '0.22') : '0.58')
    path.setAttribute('stroke', 'transparent')
    path.setAttribute('stroke-width', '0')
    svg.appendChild(path)
  }
}

function rememberText(el) {
  if (!el || DOG_TEXT.originals.has(el)) return
  DOG_TEXT.originals.set(el, { kind: 'text', value: el.textContent })
}

function rememberHtml(el) {
  if (!el || DOG_TEXT.originals.has(el)) return
  DOG_TEXT.originals.set(el, { kind: 'html', value: el.innerHTML })
}

function setText(el, text) {
  if (!el) return
  rememberText(el)
  el.textContent = text
}

function setHtml(el, html) {
  if (!el) return
  rememberHtml(el)
  el.innerHTML = html
}

export function renderDogLegend() {
  const legend = document.getElementById('legend')
  if (!legend) return
  const c = getDogModeColor()
  setHtml(legend, `
    <div class="legend-item">
      <div class="legend-dot" style="background:${c};box-shadow:0 0 4px ${c}"></div>
      <span>Woof</span>
    </div>
  `)
}

export function renderDogSoundsList({ tiles = 4 } = {}) {
  const el = document.getElementById('sounds-list')
  if (!el) return
  const c = getDogModeColor()
  const n = Math.max(1, Math.min(12, Math.floor(tiles)))
  setHtml(el, Array(n).fill(0).map((_, idx) => `
    <button type="button" class="sound-row${idx === 0 ? ' playing' : ''}" data-sound="dog" aria-label="Woof tile ${idx + 1}" style="--accent-color:${c}">
      <div class="sound-dot" style="background:${c};color:${c}"></div>
      <div class="sound-name">Woofer Woofer</div>
    </button>
  `).join(''))
}

export function applyDogModeTextOverrides() {
  if (DOG_TEXT.active) return
  DOG_TEXT.active = true

  setText(document.querySelector('.header-title'), 'A Day in the Life of Wew Woof Wity')
  setText(document.querySelector('.header-sub'), 'Woof WoofWoof Woof, Woof Woof')
  setText(document.getElementById('about-btn'), 'Woofsters')
  setText(document.querySelector('.vol-label'), 'Woofers')

  document.querySelectorAll('.panel-label').forEach(el => setText(el, 'Woof Woof Woof'))
  setText(document.querySelector('#onboarding-state p'), 'Woof. Woof woof woof woof. Woof woof. Woof? Woof! Woof woof woof.')

  setText(document.getElementById('clock-time-main'), 'Woof')
  setText(document.getElementById('clock-time-sub'), 'Woof Woof')
  setText(document.getElementById('day-transport-btn'), 'Woof Woof Woof')

  document.querySelectorAll('.timeline-time-labels span').forEach(el => setText(el, 'Woof'))

  setText(document.getElementById('dog-mode-exit'), 'ENOUGH WOOFING FOR TODAY! >:(')

  // Map labels: override via JS (no CSS hiding)
  document.querySelectorAll('#map svg text').forEach(el => setText(el, 'Woofington'))

  document.querySelectorAll('.persona-card').forEach(card => {
    setText(card.querySelector('.persona-name'), 'Woofies')
    setText(card.querySelector('.persona-meta'), 'Woofiest Woof')
    setText(card.querySelector('.persona-borough'), 'Woof Woof')
  })

  renderDogLegend()
  renderDogSoundsList({ tiles: 4 })

  mountExitButtonInStory()
}

export function clearDogModeTextOverrides() {
  if (!DOG_TEXT.active) return
  DOG_TEXT.active = false

  restoreExitButtonMount()

  for (const [el, saved] of DOG_TEXT.originals.entries()) {
    if (!el || !el.isConnected) continue
    if (saved.kind === 'html') el.innerHTML = saved.value
    else el.textContent = saved.value
  }
  DOG_TEXT.originals.clear()
}
