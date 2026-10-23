import axios from 'axios'
import type { Router } from 'vue-router'
import { http, problemOf } from './http'
import { swalConfirm, swalNotification } from '@/utils/dialogs'
import { useAuthStore } from '@/stores/auth'

/**
 * Global answers to failed requests, as in resources/js/bootstrap.js:
 * 401 -> message and back to the login page, 419 -> offer a refresh, unexpected 500 -> show the error reference and offer
 * "Notify IT". Requests can opt out with the `x-handled` config flag (login form, notify form) by handling errors itself.
 */
let shown = false

export function installErrorHandling(router: Router) {
  http.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || !error.response || error.config?.headers?.['x-handled']) {
        return Promise.reject(error)
      }
      const status = error.response.status
      const problem = problemOf(error)
      const url = error.config?.url ?? ''

      if (status === 401 && !url.includes('/auth/login') && !url.endsWith('/me')) {
        if (!shown) {
          shown = true
          useAuthStore().clear()
          await swalNotification(
            'warning',
            problem?.detail ?? 'Your session has expired. Please log in to continue.',
          )
          shown = false
          await router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
        }
      } else if (status === 419) {
        const result = await swalConfirm.fire({
          icon: 'warning',
          title: 'Page expired',
          text: problem?.detail ?? 'Refresh the page and try again.',
          confirmButtonText: 'Refresh Page',
          showCancelButton: true,
        })
        if (result.isConfirmed) window.location.reload()
      } else if (status >= 500) {
        const reference = problem?.reference
        const result = await swalConfirm.fire({
          icon: 'error',
          title: 'Something went wrong',
          html: reference
            ? `An unexpected error stopped this request.<br><small>Error reference: <b>${reference}</b></small>`
            : 'An unexpected error stopped this request.',
          confirmButtonText: reference ? 'Notify IT' : 'OK',
          showCancelButton: Boolean(reference),
          cancelButtonText: 'Close',
        })
        if (result.isConfirmed && reference)
          await router.push({ name: 'error', params: { code: '500' }, query: { ref: reference } })
      }
      return Promise.reject(error)
    },
  )
}
