import { http } from '@/api/http'
import type {
  AdminConfiguration,
  CredentialsBody,
  CrbChargeBody,
  DatabaseStatus,
  ForexBody,
  ForexRate,
  ImportedRecords,
  MessageResponse,
  RunResult,
  SyncBody,
  T24Command,
  UnsyncedClient,
} from './types'

export const t24Api = {
  commands: () => http.get<T24Command[]>('/t24/commands').then((r) => r.data),
  importedRecords: () => http.get<ImportedRecords>('/t24/imported-records').then((r) => r.data),
  /** Starts the command in the background: 202 with the message and the process id. */
  runCommand: (name: string) =>
    http
      .post<{ message: string; process_id?: number }>(`/t24/commands/${encodeURIComponent(name)}/run`)
      .then((r): RunResult => ({ status: r.status, message: r.data.message, process_id: r.data.process_id })),
  database: () => http.get<DatabaseStatus>('/t24/database').then((r) => r.data),
  saveCredentials: (body: CredentialsBody) =>
    http.put<MessageResponse>('/t24/credentials', body).then((r) => r.data),
  unsynced: () => http.get<UnsyncedClient[]>('/t24/un-synced').then((r) => r.data),
  syncClients: (body: SyncBody) =>
    http.post<MessageResponse>('/t24/sync-non-existing-clients', body).then((r) => r.data),
  forexRates: () => http.get<ForexRate[]>('/t24/forex-rates').then((r) => r.data),
  addForexRate: (body: ForexBody) => http.post<MessageResponse>('/t24/forex-rates', body).then((r) => r.data),
  updateForexRate: (id: number, ugx: string) =>
    http.put<MessageResponse>(`/t24/forex-rates/${id}`, { ugx }).then((r) => r.data),
}

export const adminConfigApi = {
  load: () => http.get<AdminConfiguration>('/admin/configuration').then((r) => r.data),
  saveCredentials: (body: CredentialsBody) =>
    http.put<MessageResponse>('/admin/configuration/t24-credentials', body).then((r) => r.data),
  saveCharges: (body: CrbChargeBody) =>
    http.put<MessageResponse>('/admin/configuration/crb-charges', body).then((r) => r.data),
}
