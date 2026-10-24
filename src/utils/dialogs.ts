import Swal from 'sweetalert2'
import iziToast from 'izitoast'
import 'izitoast/dist/css/iziToast.min.css'

/** Ports of showLoader / swalNotification / swalOk / swalConfirm / swalDelete from mixins/helper.js, styled with Tailwind. */

/**
 * SweetAlert hides the page from screen readers while it is open and, when it closes, puts back whatever aria-hidden each element
 * had when it opened. A reka dialog that closes in the same tick as a message is shown (the usual "dialog steps aside" pattern)
 * still has its own aria-hidden="true" on #app at that moment, so SweetAlert restores it and nothing removes it any more: the whole
 * page stays hidden from assistive technology until it is reloaded. After the last message closes, drop the stale attribute unless a
 * dialog or message is really open.
 */
export function releaseStaleAriaHidden() {
  requestAnimationFrame(() => {
    if (document.querySelector('.swal2-container, [role="dialog"][data-state="open"]')) return
    for (const el of Array.from(document.body.children)) {
      if (el.getAttribute('aria-hidden') === 'true' && el.id === 'app') el.removeAttribute('aria-hidden')
    }
  })
}

/** Options every message of the app shares. */
export const popupDefaults = { didClose: releaseStaleAriaHidden }

const btn = 'rounded px-4 py-2 text-sm font-medium text-white'
const green = `${btn} bg-success`
const red = `${btn} bg-danger m-2`

export function showLoader(text = 'loading, please wait..') {
  Swal.close()
  void Swal.fire({
    title: `<span style="font-size: 18px">${text}</span>`,
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
    ...popupDefaults,
  })
}

export function hideLoader() {
  Swal.close()
}

export function swalNotification(
  icon: 'success' | 'error' | 'warning' | 'info' | 'question',
  message: string,
) {
  Swal.close()
  return swalOk.fire({ icon, html: message })
}

export const swalOk = Swal.mixin({
  customClass: { confirmButton: green },
  buttonsStyling: false,
  ...popupDefaults,
})

export const swalConfirm = Swal.mixin({
  customClass: { confirmButton: green, cancelButton: red },
  buttonsStyling: false,
  ...popupDefaults,
})

export const swalDelete = Swal.mixin({
  customClass: { confirmButton: red, cancelButton: green },
  buttonsStyling: false,
  ...popupDefaults,
})

/** Bottom-left toasts, as in the Laravel layouts. */
iziToast.settings({ position: 'bottomLeft', timeout: 5000 })

export const toast = {
  success: (message: string, title = 'Success') => iziToast.success({ title, message }),
  error: (message: string, title = 'Error') => iziToast.error({ title, message }),
  warning: (message: string, title = 'Warning') => iziToast.warning({ title, message }),
  info: (message: string, title = 'Info') => iziToast.info({ title, message }),
}
