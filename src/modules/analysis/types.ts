/** POST /api/v1/analysis/pr4 */
export interface UploadResponse {
  message: string
  process_id: number
  bg_url: string
}

/** GET /api/v1/analysis/pr4/results: the metrics are text, as stored (counts as digits, percentages as the server rounded them). */
export interface AnalysisResults {
  id: number
  batch_id?: number | null
  reporting_month?: string | null
  pr4_records_count: string
  cba_records_count: string
  matching_records_count: string
  matching_records_percentage: string
  balance_records_count: string
  balance_records_percentage: string
  matching_balance_count: string
  matching_balance_percentage: string
  installment_records_count: string
  installment_records_percentage: string
  matching_installment_count: string
  matching_installment_percentage: string
  arrears_records_count: string
  arrears_records_percentage: string
  matching_arrears_count: string
  matching_arrears_percentage: string
  pr4_float_loans_records_count: string
  pr4_float_loans_records_percentage: string
  created_at?: string
}
