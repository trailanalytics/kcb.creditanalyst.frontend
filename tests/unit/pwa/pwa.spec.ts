import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@/utils/dialogs', () => ({ toast: { info: vi.fn() } }))
import { registerServiceWorker } from '@/pwa'

const pub = (file: string) => resolve(__dirname, '../../../public', file)

describe('web app manifest', () => {
  const manifest = JSON.parse(readFileSync(pub('manifest.json'), 'utf8'))

  it('describes an installable standalone app that starts on the dashboard', () => {
    expect(manifest).toMatchObject({
      name: 'KCB Credit Analyst',
      short_name: 'Credit Analyst',
      display: 'standalone',
      start_url: '/home',
      scope: '/',
    })
    expect(manifest.theme_color).toBe('#002c4d')
  })

  it('has every icon, screenshot and shortcut icon it names', () => {
    const files = [
      ...manifest.icons,
      ...manifest.screenshots,
      ...manifest.shortcuts.flatMap((s: { icons: { src: string }[] }) => s.icons),
    ].map((i: { src: string }) => i.src)
    expect(files.length).toBeGreaterThanOrEqual(12)
    for (const src of files) expect(existsSync(pub(src.replace(/^\//, ''))), src).toBe(true)
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  })

  it('has the offline page and the worker that falls back to it', () => {
    expect(readFileSync(pub('offline.html'), 'utf8')).toContain("You're Offline")
    const worker = readFileSync(pub('sw.js'), 'utf8')
    expect(worker).toContain("'/offline.html'")
    // API calls are never intercepted and pages are not stored
    expect(worker).toContain("url.pathname.startsWith('/api/')")
    expect(worker.split("request.mode === 'navigate'")[1]).not.toContain('cache.put')
  })
})

describe('registerServiceWorker', () => {
  const register = vi.fn()
  afterEach(() => {
    register.mockReset()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('does nothing in development', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })
    registerServiceWorker(false)
    window.dispatchEvent(new Event('load'))
    expect(register).not.toHaveBeenCalled()
  })

  it('registers /sw.js with the root scope in production once the page has loaded', async () => {
    register.mockResolvedValue({ addEventListener: vi.fn() })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, controller: {} },
      configurable: true,
    })
    registerServiceWorker(true)
    window.dispatchEvent(new Event('load'))
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })
})
