import { afterEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'
import { swalOk } from '@/utils/dialogs'

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

describe('messages and the aria-hidden of the page', () => {
  afterEach(() => {
    Swal.close()
    document.body.innerHTML = ''
  })

  it('does not leave #app hidden from screen readers after a message that opened while a dialog was closing', async () => {
    // a reka dialog had hidden the app; it closes in the same tick as the message opens, so SweetAlert remembers "true"
    document.body.innerHTML = '<div id="app" aria-hidden="true"></div>'
    const shown = swalOk.fire({ text: 'Saved' })
    expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')
    // the dialog removes its own attribute right after the message opened
    document.getElementById('app')?.removeAttribute('aria-hidden')
    Swal.clickConfirm()
    await shown
    await vi.waitFor(() => expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false))
  })

  it('keeps the page hidden while a dialog is still open', async () => {
    document.body.innerHTML =
      '<div id="app" aria-hidden="true"></div><div role="dialog" data-state="open"></div>'
    const shown = swalOk.fire({ text: 'Saved' })
    Swal.clickConfirm()
    await shown
    await nextFrame()
    await nextFrame()
    expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')
  })
})
