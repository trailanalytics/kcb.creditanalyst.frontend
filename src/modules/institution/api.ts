import { http } from '@/api/http'
import type { Customer } from '@/modules/customer/types'
import type { BankBranch, InstitutionRecord, Stakeholder, TransferResult } from './types'

const handled = { headers: { 'x-handled': '1' } }

export const institutionApi = {
  record: () => http.get<InstitutionRecord>('/institution').then((r) => r.data),
  saveRecord: (body: Record<string, string>) =>
    http.put<InstitutionRecord>('/institution', body, handled).then((r) => r.data),

  branch: (id: number | string) => http.get<BankBranch>(`/bank-branches/${id}`).then((r) => r.data),
  createBranch: (body: Record<string, string>) =>
    http.post<BankBranch>('/bank-branches', body, handled).then((r) => r.data),
  updateBranch: (id: number | string, body: Record<string, string>) =>
    http.put<BankBranch>(`/bank-branches/${id}`, body, handled).then((r) => r.data),
  transfer: (from: string, to: string) =>
    http
      .post<TransferResult>(
        '/bank-branches/transfer-customers',
        { from_branch: from, to_branch: to },
        handled,
      )
      .then((r) => r.data),

  /** A customer by client number; the answer is empty when there is none (GET /api/get-customer-by-cif). */
  profileByCif: (clientNumber: string) =>
    http
      .get<Customer | ''>(`/profiles/by-cif/${encodeURIComponent(clientNumber)}`)
      .then((r) => r.data || null),

  stakeholder: (id: number | string) => http.get<Stakeholder>(`/pi-stakeholders/${id}`).then((r) => r.data),
  createStakeholder: (body: Record<string, string>) =>
    http.post<Stakeholder>('/pi-stakeholders', body, handled).then((r) => r.data),
  updateStakeholder: (id: number | string, body: Record<string, string>) =>
    http.put<Stakeholder>(`/pi-stakeholders/${id}`, body, handled).then((r) => r.data),
}
