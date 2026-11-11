import type { Story } from './review'

const W = 1080
const H = 1350

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Draws the year as a portrait card, fully in the browser: nothing is uploaded and the image carries no name,
 * email or account detail, only the year's totals.
 */
export async function renderShareImage(year: number, list: Story[]): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const LIME = '#0FFF4F'
  const BLACK = '#000000'
  const GREY = '#999999'
  const OFF = '#F2F2F2'
  const font = (weight: number, size: number, display = false) =>
    `${weight} ${size}px ${display ? '"Space Grotesk", ' : ''}Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  if (document.fonts?.ready) await document.fonts.ready

  ctx.fillStyle = BLACK
  ctx.fillRect(0, 0, W, H)

  // Decorative concentric rings, top right.
  ctx.strokeStyle = 'rgba(15, 255, 79, 0.22)'
  ctx.lineWidth = 3
  for (const r of [120, 220, 320]) {
    ctx.beginPath()
    ctx.arc(W - 40, 40, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  const x = 88
  // Lime pill label.
  ctx.font = font(700, 30)
  const label = `MY ${year} IN CARBON`
  const lw = ctx.measureText(label).width + 56
  ctx.fillStyle = LIME
  ctx.beginPath()
  ctx.roundRect(x, 104, lw, 64, 32)
  ctx.fill()
  ctx.fillStyle = BLACK
  ctx.fillText(label, x + 28, 147)

  const [first, ...rest] = list
  let y = 250
  if (first) {
    // Hero block: lime panel with black type.
    ctx.fillStyle = LIME
    ctx.beginPath()
    ctx.roundRect(x - 28, y, W - 2 * x + 56, 300, 44)
    ctx.fill()
    ctx.fillStyle = BLACK
    ctx.font = font(600, 28)
    ctx.fillText(first.eyebrow.toUpperCase(), x + 20, y + 70)
    ctx.font = font(700, 120, true)
    ctx.fillText(first.headline, x + 20, y + 200)
    ctx.font = font(500, 32)
    wrap(ctx, first.detail, W - 2 * x - 40)
      .slice(0, 1)
      .forEach((l) => ctx.fillText(l, x + 20, y + 256))
    y += 300 + 96
  }

  for (const s of rest.slice(0, 3)) {
    ctx.fillStyle = LIME
    ctx.font = font(600, 26)
    ctx.fillText(s.eyebrow.toUpperCase(), x, y)
    ctx.fillStyle = OFF
    ctx.font = font(700, 64, true)
    ctx.fillText(s.headline, x, y + 72)
    ctx.fillStyle = GREY
    ctx.font = font(400, 28)
    wrap(ctx, s.detail, W - 2 * x)
      .slice(0, 2)
      .forEach((l, i) => ctx.fillText(l, x, y + 118 + i * 36))
    y += 210
    ctx.fillStyle = 'rgba(242, 242, 242, 0.14)'
    ctx.fillRect(x, y - 44, W - 2 * x, 2)
  }

  ctx.fillStyle = LIME
  ctx.beginPath()
  ctx.arc(x + 10, H - 90, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = OFF
  ctx.font = font(500, 28)
  ctx.fillText('CO2 Tracker · kg CO2e from logged activities', x + 36, H - 80)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the image'))), 'image/png'),
  )
}
