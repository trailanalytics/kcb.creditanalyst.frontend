import { http } from '@/api/http'
import type { UploadResult } from './types'

const handled = { headers: { 'x-handled': '1' } }

function send(path: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return http.post<UploadResult>(path, body, handled).then((r) => r.data)
}

export const chequeApi = {
  uploadCheques: (file: File) => send('/bounced-cheques/upload', file),
  uploadFullyPaid: (file: File) => send('/fully-paid-or-write-offs/upload', file),
}
