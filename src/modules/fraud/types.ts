import type { Customer, DateParts } from '@/modules/customer/types'

/** A financial malpractice record with its customer (GET /fraud). Dates are yyyyMMdd strings, amounts are strings. */
export interface FraudRecord {
  id: number
  clientNumber: string
  fraudCategory: string | null
  IncidentDate: string | null
  SavingsAmount: string | null
  LossAmount: string | null
  currency: string | null
  IncidentDetails: string | null
  forensicInformationAvailable: string | null
  category_name: string
  incident_date_variable: DateParts
  customer: Customer | null
}
