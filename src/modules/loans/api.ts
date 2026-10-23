import { http } from '@/api/http'
import type {
  CreditCardResult,
  ForceCloseEntry,
  ForceCloseImportResult,
  IgnoreResult,
  LoanView,
  OffBalanceSaveResult,
} from './types'

/** Every call here shows its own errors, so the global handler stays out of the way for 4xx answers. */
const handled = { headers: { 'x-handled': '1' } }

const upload = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData()
  form.append('file', file)
  Object.entries(extra).forEach(([k, v]) => form.append(k, v))
  return form
}

export const loansApi = {
  view: (id: number | string) => http.get<LoanView>(`/loans/${id}`).then((r) => r.data),
  repayments: (id: number | string) => http.get<LoanView>(`/loans/${id}/repayments`).then((r) => r.data),
  writeOffForm: (id: number | string) => http.get<LoanView>(`/loans/${id}/write-off`).then((r) => r.data),
  writeOff: (id: number | string, body: Record<string, string>) =>
    http.post<{ message: string }>(`/loans/${id}/write-off`, body, handled).then((r) => r.data),

  ignore: (accounts: string[]) =>
    http.post<IgnoreResult>('/ignored-accounts', { accounts }, handled).then((r) => r.data),
  unignore: (contractCode: string) =>
    http
      .delete<{ message: string }>(`/ignored-accounts/${encodeURIComponent(contractCode)}`, handled)
      .then((r) => r.data),

  forceClose: (accounts: ForceCloseEntry[]) =>
    http
      .post<{ message: string; closed: number }>('/force-closed-accounts', { accounts }, handled)
      .then((r) => r.data),
  forceCloseUpload: (file: File, includeInCba: boolean, onProgress: (percent: number) => void) =>
    http
      .post<ForceCloseImportResult>(
        '/force-closed-accounts/upload',
        upload(file, { include_in_cba: includeInCba ? '1' : '0' }),
        {
          ...handled,
          onUploadProgress: (e) => onProgress(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
        },
      )
      .then((r) => r.data),

  openAccounts: (file: File) =>
    http.post<Blob>('/open-accounts/export', upload(file), { ...handled, responseType: 'blob' }),
  creditCards: (file: File) =>
    http.post<CreditCardResult>('/credit-cards/upload', upload(file), handled).then((r) => r.data),

  saveOffBalance: (items: { id: number; clientNumber: string }[]) =>
    http.put<OffBalanceSaveResult>('/off-balance-sheet-items', { items }, handled).then((r) => r.data),
  deleteOffBalance: (id: number) =>
    http.delete<{ message: string }>(`/off-balance-sheet-items/${id}`, handled).then((r) => r.data),
}
