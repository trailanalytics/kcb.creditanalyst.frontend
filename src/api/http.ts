import axios from 'axios'

/** Laravel-style validation / problem-details body (RFC 9457) returned by the API. */
export interface ProblemDetail {
  title?: string
  status?: number
  detail?: string
  /** Set on unexpected 500s: ERR-yyMMdd-HHmmss-XXXX, quoted when notifying IT. */
  reference?: string
  errors?: Record<string, string[]>
}

/**
 * One axios instance for the whole app. Same-origin `/api` (proxied in dev, nginx in prod), session cookie auth,
 * and Spring Security's CSRF cookie/header pair, which are axios' default names (XSRF-TOKEN / X-XSRF-TOKEN).
 */
export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

export function problemOf(error: unknown): ProblemDetail | null {
  return axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
    ? (error.response.data as ProblemDetail)
    : null
}

/** The message to show for a failed request: the server's detail, else the fallback. */
export function messageOf(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return problemOf(error)?.detail ?? fallback
}
