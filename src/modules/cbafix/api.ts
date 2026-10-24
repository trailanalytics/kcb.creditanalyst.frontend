import { http } from '@/api/http'
import type {
  CbaColumn,
  DownloadQueued,
  FixAllResult,
  FixResult,
  GridPage,
  QueuedProcess,
  RemoveResult,
  SaveResult,
  Validations,
} from './types'

export interface ListParams {
  page: number
  per_page: number
  search?: string
  rule?: string
}

/** One account of a save: the two keys that find the row plus the cells that changed, all by header name. */
export type SaveAccount = Record<string, string | null>

export const cbaFixApi = {
  columns() {
    return http.get<CbaColumn[]>('/cba/columns').then((r) => r.data)
  },

  list(params: ListParams) {
    const query: Record<string, string | number> = { page: params.page, per_page: params.per_page }
    if (params.search) query.search = params.search
    if (params.rule) query.rule = params.rule
    return http.get<GridPage>('/cba/accounts', { params: query }).then((r) => r.data)
  },

  save(accounts: SaveAccount[]) {
    return http.put<SaveResult>('/cba/accounts', { accounts }).then((r) => r.data)
  },

  remove(reference: string) {
    return http.delete<RemoveResult>(`/cba/accounts/${encodeURIComponent(reference)}`).then((r) => r.data)
  },

  validations() {
    return http.get<Validations>('/cba/validations').then((r) => r.data)
  },

  fix(rule: string) {
    return http.post<FixResult>(`/cba/validations/${encodeURIComponent(rule)}/fix`).then((r) => r.data)
  },

  fixAll() {
    return http.post<FixAllResult>('/cba/validations/fix-all').then((r) => r.data)
  },

  /**
   * "Download Short CBA": writes the file from the table as it is now (the CBA generation slice). The body is the report date and
   * the DSM version; the answer is the process to follow on the background processes page.
   */
  download(toDate: string, version: '7.0' | '8.0') {
    return http.post<DownloadQueued>('/cba/download', { toDate, version }).then((r) => r.data)
  },

  /** The uploads answer their own failures (409, 422 and 500 carry the message the page shows). */
  upload(
    endpoint: 'delete-records' | 'fix-customer-details',
    form: FormData,
    onProgress: (percent: number) => void,
  ) {
    return http
      .post<QueuedProcess>(`/cba/fix/${endpoint}`, form, {
        headers: { 'x-handled': '1' },
        onUploadProgress: (e) => {
          if (e.total) onProgress(Math.round((e.loaded * 100) / e.total))
        },
      })
      .then((r) => r.data)
  },
}

export const TEMPLATE_URLS = {
  'delete-records': '/api/v1/cba/fix/template/delete-records',
  'fix-customer': '/api/v1/cba/fix/template/fix-customer',
} as const
