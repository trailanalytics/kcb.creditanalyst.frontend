import { http } from '@/api/http'
import type { Paginated } from '@/composables/useCollection'
import type { Application, BulkItem, LoanAccountRow, PendingRow } from './types'

const handled = { headers: { 'x-handled': '1' } }

export interface DuplicateCheck {
  duplicate: boolean
  message?: string
}

export const applicationsApi = {
  get: (id: number | string) => http.get<Application>(`/applications/${id}`).then((r) => r.data),
  loanAccounts: (id: number | string) =>
    http.get<LoanAccountRow[]>(`/applications/${id}/loan-accounts`).then((r) => r.data),
  checkDuplicate: (borrower: string, body: Record<string, unknown>) =>
    http.post<DuplicateCheck>(`/applications/check-duplicate/${borrower}`, body, handled).then((r) => r.data),
  create: (body: Record<string, unknown>) =>
    http.post<Application>('/applications', body, handled).then((r) => r.data),
  update: (id: number | string, body: Record<string, unknown>) =>
    http.put<Application>(`/applications/${id}`, body, handled).then((r) => r.data),
  joint: (body: Record<string, unknown>) =>
    http
      .post<{ message: string; jointAccountNumber: string }>('/applications/joint', body, handled)
      .then((r) => r.data),
  decide: (id: number | string, body: Record<string, unknown>) =>
    http.post<Application>(`/applications/${id}/decision`, body, handled).then((r) => r.data),
  pending: (page: number) =>
    http.get<Paginated<PendingRow>>('/applications/pending', { params: { page } }).then((r) => r.data),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http
      .post<{ message: string; saved: number; unknown: string[] }>(
        '/applications/pending/upload',
        form,
        handled,
      )
      .then((r) => r.data)
  },
  bulkApprove: (items: BulkItem[]) =>
    http
      .post<{ message: string; approved: number; declined: number; skipped: string[] }>(
        '/applications/bulk-approve',
        { items },
        handled,
      )
      .then((r) => r.data),
  downloadPending: () => http.get<Blob>('/applications/pending/download', { responseType: 'blob' }),
  report: (params: Record<string, string>) =>
    http.get<Blob>('/applications/export', { params, responseType: 'blob', ...handled }),
}
