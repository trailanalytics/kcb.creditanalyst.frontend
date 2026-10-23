import { http } from '@/api/http'
import type { Paginated } from '@/composables/useCollection'
import type { Customer, CustomerRow, Existence, ProfileModel } from './types'

const handled = { headers: { 'x-handled': '1' } }

export const profilesApi = {
  get: (id: number | string) => http.get<Customer>(`/profiles/${id}`).then((r) => r.data),
  update: (id: number | string, form: ProfileModel) =>
    http.put<Customer>(`/profiles/${id}`, form, handled).then((r) => r.data),
  existence: (id: number) => http.get<Existence>(`/profiles/${id}/existence`).then((r) => r.data),
  changeClassification: (clientNumber: string, classificationCode: string) =>
    http
      .post<{ message: string }>('/profiles/classification', { clientNumber, classificationCode }, handled)
      .then((r) => r.data),
  forceFind: (search: string) =>
    http
      .post<{ found: boolean; profile: Customer }>('/profiles/force-find', { search }, handled)
      .then((r) => r.data),
  createNonExisting: (body: Record<string, unknown>) =>
    http
      .post<{ message: string; clientNumber: string }>('/non-existing-customers', body, handled)
      .then((r) => r.data),
  customers: (search: string, page: number) =>
    http
      .get<Paginated<CustomerRow>>('/borrowers/customers', { params: { search, page } })
      .then((r) => r.data),
}
