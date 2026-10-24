import { http } from '@/api/http'
import type { BranchOption, DeletedCount, Lookups, UserDetail, UserForm } from './types'

export const usersApi = {
  lookups: () => http.get<Lookups>('/users/lookups').then((r) => r.data),
  branches: () => http.get<BranchOption[]>('/reference/branches').then((r) => r.data),
  get: (id: number | string) => http.get<UserDetail>(`/users/${id}`).then((r) => r.data),
  create: (form: UserForm) =>
    http.post<UserDetail>('/users', body(form), { headers: { 'x-handled': '4xx' } }).then((r) => r.data),
  update: (id: number | string, form: UserForm) =>
    http.put<UserDetail>(`/users/${id}`, body(form), { headers: { 'x-handled': '4xx' } }).then((r) => r.data),
}

/** An empty password is sent as null: on update it means "keep the current one". */
function body(form: UserForm) {
  return { ...form, password: form.password === '' ? null : form.password }
}

export const logsApi = {
  deletedRecords: () =>
    http.get<{ data: DeletedCount[]; total: number }>('/deleted-records-count').then((r) => r.data),
  export: (logType: string, from: string, to: string, format: string) =>
    http.post<Blob>('/logs/export', { logType, from, to, format }, { responseType: 'blob' }),
}
