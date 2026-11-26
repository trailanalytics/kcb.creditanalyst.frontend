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
  /** Puts the page back in the state to capture (reopens a menu the list closed by redrawing); run again when a mark is gone. */
  prepare?: () => Promise<void>
}

export async function figure(page: Page, role: string, id: string, caption: string, marks: Mark[] = [], opts: FigureOptions = {}) {
  const dir = path.join(OUT, role)
  fs.mkdirSync(dir, { recursive: true })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts?.ready)

  let boxes: { x: number; y: number; width: number; height: number; tip: string; side: Mark['side'] | null; quiet: boolean }[] = []
  for (let attempt = 1; ; attempt++) {
    if (opts.prepare) await opts.prepare()
    boxes = await measure(marks)
    if (boxes.every(Boolean) || !opts.prepare || attempt >= 4) break
  }
  const lost = boxes.findIndex((b) => !b)
  if (lost >= 0) throw new Error(`guide figure ${role}/${id}: mark "${marks[lost].tip}" is not visible`)
  await page.evaluate((items) => {
    const layer = document.createElement('div')
    layer.id = '__guide_layer'
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Arial,Helvetica,sans-serif'
    const W = window.innerWidth
    const H = window.innerHeight
    const pad = 4
    type R = { l: number; t: number; r: number; b: number }
    const hit = (a: R, b: R) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
    // every outlined element is an obstacle for every tip, and so is each tip already placed
    const taken: R[] = items.map((b) => ({ l: b.x - pad - 12, t: b.y - pad - 12, r: b.x + b.width + pad, b: b.y + b.height + pad }))
    // toasts left over from an earlier step are hidden unless the figure is about one (a mark inside it)
    const toasts = Array.from(document.querySelectorAll<HTMLElement>('.iziToast-wrapper, .iziToast-capsule'))
    const marked = (el: HTMLElement) => items.some((b) => { const r = el.getBoundingClientRect(); return b.x >= r.left && b.x <= r.right && b.y >= r.top && b.y <= r.bottom })
    toasts.forEach((el) => { if (!marked(el)) { el.dataset.guideHidden = el.style.visibility; el.style.visibility = 'hidden' } })
    items.forEach((b, i) => {
      const n = i + 1
      const box = document.createElement('div')
      box.style.cssText = `position:fixed;left:${b.x - pad}px;top:${b.y - pad}px;width:${b.width + 2 * pad}px;height:${b.height + 2 * pad}px;border:2.5px solid #E8731C;border-radius:6px;box-shadow:0 0 0 2px rgba(255,255,255,.7)`
      layer.appendChild(box)
      const badge = document.createElement('div')
      badge.textContent = String(n)
      badge.style.cssText = `position:fixed;left:${Math.max(2, b.x - pad - 11)}px;top:${Math.max(2, b.y - pad - 11)}px;width:22px;height:22px;border-radius:11px;background:#E8731C;color:#fff;font-weight:700;font-size:13px;line-height:22px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.35)`
      layer.appendChild(badge)
    })
    items.forEach((b, i) => {
      if (b.quiet) return
      const n = i + 1
      const tip = document.createElement('div')
      tip.textContent = `${n}. ${b.tip}`
      tip.style.cssText = 'position:fixed;max-width:230px;padding:5px 8px;background:#fff;border:1.5px solid #E8731C;border-radius:5px;color:#222;font-size:12px;line-height:1.3;box-shadow:0 1px 3px rgba(0,0,0,.25)'
      layer.appendChild(tip)
      const tw = Math.min(230, tip.offsetWidth)
      tip.style.width = `${tw}px` // keep the measured width: a box pushed against the edge would otherwise wrap into a narrow column
      const th = tip.offsetHeight
      const at = (side: string, shift = 0): R => {
        let l = 0
        let t = 0
        if (side === 'right') { l = b.x + b.width + pad + 10; t = b.y + b.height / 2 - th / 2 + shift }
        if (side === 'left') { l = b.x - pad - 10 - tw; t = b.y + b.height / 2 - th / 2 + shift }
        if (side === 'below') { l = b.x + shift; t = b.y + b.height + pad + 8 }
        if (side === 'above') { l = b.x + shift; t = b.y - pad - 8 - th }
        l = Math.max(4, Math.min(l, W - tw - 4))
        t = Math.max(4, Math.min(t, H - th - 4))
        return { l, t, r: l + tw, b: t + th }
      }
      const sides = [b.side, 'right', 'left', 'below', 'above'].filter((x, k, a) => x && a.indexOf(x) === k) as string[]
      const shifts = [0, 40, -40, 80, -80, 120, -120, 180, -180]
      let best: R | null = null
      for (const shift of shifts) {
        for (const side of sides) {
          const r = at(side, shift)
          if (!taken.some((o) => hit(r, o))) { best = r; break }
        }
        if (best) break
      }
      best ??= at(sides[0])
      tip.style.left = `${best.l}px`
      tip.style.top = `${best.t}px`
      taken.push({ l: best.l - 4, t: best.t - 4, r: best.r + 4, b: best.b + 4 })
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
  await page.evaluate(() => {
    document.getElementById('__guide_layer')?.remove()
    document.querySelectorAll<HTMLElement>('[data-guide-hidden]').forEach((el) => {
      el.style.visibility = el.dataset.guideHidden ?? ''
      delete el.dataset.guideHidden
    })
  })
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

async function measure(marks: Mark[]) {
  // lists reload after a search and dialogs animate in: wait until every marked element is on screen before measuring
  for (const m of marks) {
    await m.target.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    await m.target.first().scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {})
  }
  const out = []
  for (const m of marks) {
    const b = await m.target.first().boundingBox({ timeout: 5_000 }).catch(() => null)
    out.push(b ? { ...b, tip: m.tip, side: m.side ?? null, quiet: !!m.quiet } : (null as never))
  }
  return out
}
