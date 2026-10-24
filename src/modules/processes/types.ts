export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** One row of GET /api/v1/background-processes. Dates are `dd MMM yyyy HH:mm`, as the page showed them. */
export interface BackgroundProcess {
  id: number
  type: string
  title: string
  status: ProcessStatus
  progress: number
  progress_label: string | null
  error_message: string | null
  has_file: boolean
  result_url: string | null
  started_at: string | null
  created_at: string
  completed_at: string | null
  user_name: string | null
}

/** GET /api/v1/background-processes/{id}: the fields that change while a process runs. */
export interface ProcessUpdate {
  id: number
  type: string
  title: string
  status: ProcessStatus
  progress: number
  progress_label: string | null
  has_file: boolean
  result_url: string | null
  error_message: string | null
  completed_at: string | null
}

export interface ProcessMessage {
  message: string
  new_process_id?: number
}
