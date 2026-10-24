import { http } from '@/api/http'
import type { Paginated } from '@/composables/useCollection'
import type { BackgroundProcess, ProcessMessage, ProcessUpdate } from './types'

export const processApi = {
  list(page: number) {
    return http
      .get<Paginated<BackgroundProcess>>('/background-processes', {
        params: { page },
        headers: { 'x-handled': '1' },
      })
      .then((r) => r.data)
  },
  status(id: number) {
    return http
      .get<ProcessUpdate>(`/background-processes/${id}`, { headers: { 'x-handled': '1' } })
      .then((r) => r.data)
  },
  /** The finished file of a process, for saving; failures come back as a blob holding the problem details. */
  download(id: number) {
    return http.get<Blob>(`/background-processes/${id}/download`, { responseType: 'blob' })
  },
  kill(id: number) {
    return http
      .post<ProcessMessage>(`/background-processes/${id}/kill`, {}, { headers: { 'x-handled': '1' } })
      .then((r) => r.data)
  },
  override(id: number) {
    return http
      .post<ProcessMessage>(`/background-processes/${id}/override`, {}, { headers: { 'x-handled': '1' } })
      .then((r) => r.data)
  },
  retry(id: number) {
    return http
      .post<ProcessMessage>(`/background-processes/${id}/retry`, {}, { headers: { 'x-handled': '1' } })
      .then((r) => r.data)
  },
  /** The number on the PROCESSES tile of the home page: every pending or processing process. */
  activeCount() {
    return http.get<{ count: number }>('/background-processes/active-count').then((r) => r.data.count)
  },
}
