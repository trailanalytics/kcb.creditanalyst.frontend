/// <reference lib="dom" />
import { test, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Screenshots for the stakeholder guides, drawn the way the guide template shows them: an orange outline round each place
 * to click, a numbered orange badge on it and a short tip beside it. The same numbered tips are written to the manifest,
 * and tools/guide/build-docx.mjs lists them under the figure.
 *
 *   await figure(page, 'officer', 'profiles-search', 'Find a borrower', [
 *     { target: page.getByPlaceholder('Search by name, client no, FCS no...'), tip: 'Type a name or client number' },
 *     { target: page.getByRole('link', { name: 'Okello James Peter' }), tip: 'Click the name to open the profile' },
 *   ])
 *
 * Output: guide-out/<role>/<id>.png and guide-out/<role>/<id>.json (one file per figure, so journeys can be rerun one at a time).
 */
export const OUT = path.resolve(process.env.GUIDE_OUT ?? 'guide-out')

export interface Mark {
  target: Locator
  tip: string
  /** Where the tip goes relative to the outlined element. Default: right if there is room, else left, else below. */
  side?: 'right' | 'left' | 'below' | 'above'
  /** No tip box on the picture (the tip is still listed under the figure). */
  quiet?: boolean
}

export interface FigureOptions {
  /** Capture only this element (plus a margin) instead of the viewport. */
  clip?: Locator
  /** The whole scrollable page. */
  fullPage?: boolean
  /** Extra numbered steps listed under the figure that are not marked on the picture. */
  steps?: string[]
  /** Elements to blur (none of the fixture data is real, but a real name could appear in a shared list). */
  mask?: Locator[]
  margin?: number
}

export async function figure(page: Page, role: string, id: string, caption: string, marks: Mark[] = [], opts: FigureOptions = {}) {
  const dir = path.join(OUT, role)
  fs.mkdirSync(dir, { recursive: true })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts?.ready)

  const boxes = []
  for (const m of marks) {
    await m.target.first().scrollIntoViewIfNeeded().catch(() => {})
  }
  for (const m of marks) {
    const b = await m.target.first().boundingBox()
    if (!b) throw new Error(`guide figure ${role}/${id}: mark "${m.tip}" is not visible`)
    boxes.push({ ...b, tip: m.tip, side: m.side ?? null, quiet: !!m.quiet })
  }
  await page.evaluate((items) => {
    const layer = document.createElement('div')
    layer.id = '__guide_layer'
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Arial,Helvetica,sans-serif'
    const W = window.innerWidth
    items.forEach((b, i) => {
      const n = i + 1
      const pad = 4
      const box = document.createElement('div')
      box.style.cssText = `position:fixed;left:${b.x - pad}px;top:${b.y - pad}px;width:${b.width + 2 * pad}px;height:${b.height + 2 * pad}px;border:2.5px solid #E8731C;border-radius:6px;box-shadow:0 0 0 2px rgba(255,255,255,.7)`
      layer.appendChild(box)
      const badge = document.createElement('div')
      badge.textContent = String(n)
      badge.style.cssText = `position:fixed;left:${Math.max(2, b.x - pad - 11)}px;top:${Math.max(2, b.y - pad - 11)}px;width:22px;height:22px;border-radius:11px;background:#E8731C;color:#fff;font-weight:700;font-size:13px;line-height:22px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.35)`
      layer.appendChild(badge)
      if (b.quiet) return
      const tip = document.createElement('div')
      tip.textContent = `${n}. ${b.tip}`
      tip.style.cssText = 'position:fixed;max-width:230px;padding:5px 8px;background:#fff;border:1.5px solid #E8731C;border-radius:5px;color:#222;font-size:12px;line-height:1.3;box-shadow:0 1px 3px rgba(0,0,0,.25)'
      layer.appendChild(tip)
      const tw = Math.min(230, tip.offsetWidth)
      const th = tip.offsetHeight
      let side = b.side
      if (!side) side = b.x + b.width + pad + 12 + tw < W ? 'right' : b.x - pad - 12 - tw > 0 ? 'left' : 'below'
      let left = 0
      let top = 0
      if (side === 'right') { left = b.x + b.width + pad + 10; top = b.y + b.height / 2 - th / 2 }
      if (side === 'left') { left = b.x - pad - 10 - tw; top = b.y + b.height / 2 - th / 2 }
      if (side === 'below') { left = b.x; top = b.y + b.height + pad + 8 }
      if (side === 'above') { left = b.x; top = b.y - pad - 8 - th }
      tip.style.left = `${Math.max(4, Math.min(left, W - tw - 4))}px`
      tip.style.top = `${Math.max(4, top)}px`
    })
    document.body.appendChild(layer)
  }, boxes)

  let clip
  if (opts.clip) {
    const c = await opts.clip.first().boundingBox()
    const m = opts.margin ?? 12
    const vp = page.viewportSize()!
    if (c) {
      const x = Math.max(0, c.x - m)
      const y = Math.max(0, c.y - m)
      clip = { x, y, width: Math.min(vp.width - x, c.width + 2 * m + 240), height: Math.min(vp.height - y, c.height + 2 * m) }
    }
  }
  const file = path.join(dir, `${id}.png`)
  await page.screenshot({ path: file, clip, fullPage: opts.fullPage, animations: 'disabled', mask: opts.mask, maskColor: '#C9CED6' })
  await page.evaluate(() => document.getElementById('__guide_layer')?.remove())
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({ role, id, caption, image: `${id}.png`, marks: marks.map((m) => m.tip), steps: opts.steps ?? [], spec: test.info().titlePath.join(' › ') }, null, 1),
  )
  return file
}

/** A message box (SweetAlert) or toast text recorded for the "Messages and what to do" table. */
export function message(role: string, text: string, what: string) {
  const dir = path.join(OUT, role)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, '_messages.json')
  const list: { text: string; what: string }[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  if (!list.some((m) => m.text === text)) list.push({ text, what })
  fs.writeFileSync(file, JSON.stringify(list, null, 1))
}
