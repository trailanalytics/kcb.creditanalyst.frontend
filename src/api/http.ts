import axios from 'axios'

/**
 * One axios instance for the whole app. Same-origin `/api` (proxied in dev, nginx in prod), session cookie auth,
 * and Spring Security's CSRF cookie/header pair, which are axios' default names (XSRF-TOKEN / X-XSRF-TOKEN).
 */
export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

export function installUnauthorizedHandler(onUnauthorized: () => void) {
  http.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) onUnauthorized()
      return Promise.reject(error)
    },
  )
}
