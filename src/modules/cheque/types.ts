import type { Customer } from '@/modules/customer/types'

/** A bounced cheque with its customer (GET /bounced-cheques). Dates are yyyyMMdd strings, amounts are strings. */
export interface BouncedCheque {
  id: number
  clientNumber: string
  ChequeNumber: string
  ChequeAmount: string | null
  ChequeCurrency: string | null
  ChequeBounceDate: string | null
  customer: Customer | null
  [column: string]: unknown
}

export interface UploadResult {
  uploaded: number
  not_found: string[]
  message: string
}
