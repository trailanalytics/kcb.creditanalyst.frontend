import { http } from '@/api/http'
import type { Paginated } from '@/composables/useCollection'
import type { AttachResult, CollateralRow, GuarantorRow, Overview, StakeholderRow } from './types'

const handled = { headers: { 'x-handled': '1' } }

export const securitiesApi = {
  overview: (referenceNumber: string) =>
    http.get<Overview>('/securities', { params: { referenceNumber }, ...handled }).then((r) => r.data),
}

export const collateralsApi = {
  create: (body: Record<string, unknown>) =>
    http.post<CollateralRow>('/collaterals', body, handled).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<CollateralRow>(`/collaterals/${id}`, body, handled).then((r) => r.data),
  attach: (referenceNumber: string, collateralReferenceNumber: string) =>
    http
      .post<AttachResult>('/collaterals/attach', { referenceNumber, collateralReferenceNumber }, handled)
      .then((r) => r.data),
  mapInstruments: (change_from: string, change_to: string) =>
    http
      .post<{ message: string; updated: number }>(
        '/collaterals/map-instruments',
        { change_from, change_to },
        handled,
      )
      .then((r) => r.data),
}

export const guarantorsApi = {
  create: (body: Record<string, unknown>) =>
    http.post<GuarantorRow>('/guarantors', body, handled).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<GuarantorRow>(`/guarantors/${id}`, body, handled).then((r) => r.data),
  attach: (referenceNumber: string, guarantorId: number) =>
    http
      .post<AttachResult>('/guarantors/attach', { referenceNumber, guarantorId }, handled)
      .then((r) => r.data),
}

export const stakeholdersApi = {
  create: (body: Record<string, unknown>) =>
    http.post<StakeholderRow>('/stakeholders', body, handled).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<StakeholderRow>(`/stakeholders/${id}`, body, handled).then((r) => r.data),
  list: (queryFilter: string, search: string, page: number) =>
    http
      .get<Paginated<StakeholderRow>>('/stakeholders', { params: { queryFilter, search, page } })
      .then((r) => r.data),
}
