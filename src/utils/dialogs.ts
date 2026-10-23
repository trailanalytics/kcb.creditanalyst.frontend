import Swal from 'sweetalert2'
import iziToast from 'izitoast'
import 'izitoast/dist/css/iziToast.min.css'

/** Ports of showLoader / swalNotification / swalOk / swalConfirm / swalDelete from mixins/helper.js, styled with Tailwind. */

const btn = 'rounded px-4 py-2 text-sm font-medium text-white'
const green = `${btn} bg-success`
const red = `${btn} bg-danger m-2`

export function showLoader(text = 'loading, please wait..') {
  Swal.close()
  void Swal.fire({
    title: `<span style="font-size: 18px">${text}</span>`,
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
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

export const swalOk = Swal.mixin({ customClass: { confirmButton: green }, buttonsStyling: false })

export const swalConfirm = Swal.mixin({
  customClass: { confirmButton: green, cancelButton: red },
  buttonsStyling: false,
})

export const swalDelete = Swal.mixin({
  customClass: { confirmButton: red, cancelButton: green },
  buttonsStyling: false,
})

/** Bottom-left toasts, as in the Laravel layouts. */
iziToast.settings({ position: 'bottomLeft', timeout: 5000 })

export const toast = {
  success: (message: string, title = 'Success') => iziToast.success({ title, message }),
  error: (message: string, title = 'Error') => iziToast.error({ title, message }),
  warning: (message: string, title = 'Warning') => iziToast.warning({ title, message }),
  info: (message: string, title = 'Info') => iziToast.info({ title, message }),
}
