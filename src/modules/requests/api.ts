import { http } from '@/api/http'
import type { RecordView, RequestMessage } from './types'

/**
 * The Requests page's calls. The list goes through useCollection; the decisions and the record view are here. The page shows the server's message
 * when one of them fails.
 */
export const requestApi = {
  record(id: number) {
    return http.get<RecordView>(`/deletion-requests/${id}`).then((r) => r.data)
  },
  approve(id: number, comment = '') {
    return http.post<RequestMessage>(`/deletion-requests/${id}/approve`, { comment }).then((r) => r.data)
  },
  cancel(id: number, comment = '') {
    return http.post<RequestMessage>(`/deletion-requests/${id}/cancel`, { comment }).then((r) => r.data)
  },
}
