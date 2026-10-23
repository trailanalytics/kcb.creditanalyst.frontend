import { http } from '@/api/http'
import type { FraudRecord } from './types'

const handled = { headers: { 'x-handled': '1' } }

export const fraudApi = {
  create: (body: Record<string, unknown>) =>
    http.post<FraudRecord>('/fraud', body, handled).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<FraudRecord>(`/fraud/${id}`, body, handled).then((r) => r.data),
}
