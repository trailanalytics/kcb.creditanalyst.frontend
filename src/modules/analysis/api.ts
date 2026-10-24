import { http } from '@/api/http'
import type { AnalysisResults, UploadResponse } from './types'

export const analysisApi = {
  /**
   * The request handles its own failures (409, 422 and 500 all carry the message the page shows), so the global dialog for
   * unexpected errors stays out of the way.
   */
  upload(form: FormData, onProgress: (percent: number) => void) {
    return http
      .post<UploadResponse>('/analysis/pr4', form, {
        headers: { 'x-handled': '1' },
        onUploadProgress: (e) => {
          if (e.total) onProgress(Math.round((e.loaded * 100) / e.total))
        },
      })
      .then((r) => r.data)
  },

  /** The latest analysis, or the one of an upload batch; null when nothing was analysed yet. */
  results(batchId?: number) {
    return http
      .get<{ results: AnalysisResults | null }>('/analysis/pr4/results', {
        params: batchId ? { batch_id: batchId } : undefined,
      })
      .then((r) => r.data.results)
  },
}
