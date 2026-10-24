import { http } from '@/api/http'
import type { CbaGenerateBody, FileReportBody, OutputFileRow, ReportType, SubmissionAnalysis } from './types'

/** Every call here shows its own errors, so the global dialog for unexpected errors stays out of the way for 4xx answers. */
const handled = { headers: { 'x-handled': '1' } }

export const reportsApi = {
  /** One of the nine files, built while the request runs; answers with the file. */
  download: (type: ReportType, body: FileReportBody) =>
    http.post<Blob>(`/reports/${type}`, body, { ...handled, responseType: 'blob' }),

  /** The CBA file is a background process of the CBA slice: 202 {process_id}, 409 when one is already running. */
  generateCba: (body: CbaGenerateBody) =>
    http.post<{ process_id: number }>('/cba/generate', body, handled).then((r) => r.data),

  analysis: () => http.get<SubmissionAnalysis>('/reports/submission-analysis').then((r) => r.data),
  analysisPdf: () => http.get<Blob>('/reports/submission-analysis/pdf', { ...handled, responseType: 'blob' }),
}

export const outputFilesApi = {
  list: () => http.get<{ data: OutputFileRow[] }>('/output-files').then((r) => r.data.data),
  download: (id: number) =>
    http.get<Blob>(`/output-files/${id}/download`, { ...handled, responseType: 'blob' }),
  extract: (form: FormData) =>
    http.post<Blob>('/output-files/extract', form, { ...handled, responseType: 'blob' }),
  convertExcel: (form: FormData) =>
    http.post<Blob>('/output-files/upload-excel', form, { ...handled, responseType: 'blob' }),
}
