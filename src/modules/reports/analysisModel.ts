import { formatNumber } from '@/utils/format'

export { formatNumber }

/** Counts and amounts: thousands separators, no decimals. */
export const money = (v: number | string | null | undefined) => formatNumber(v)

/** The four blocks of the analysis page, shown only when their count is above zero. */
export function visibleSections(a: {
  stakeholders: { count: number }
  bounced_cheques: { count: number }
  credit_applications: { count: number }
  credit_accounts: { count: number }
}) {
  return {
    stakeholders: a.stakeholders.count > 0,
    bounced: a.bounced_cheques.count > 0,
    applications: a.credit_applications.count > 0,
    accounts: a.credit_accounts.count > 0,
  }
}

/** The "code: x" line under a branch, product, status or reason name. */
export const codeLine = (code: string | null | undefined) => `code: ${code ?? ''}`

/** The account cell of the top ten tables. */
export const accountName = (name: string) => name.trim() || 'Unnamed customer'

/** `5, Sep 2025` of a yyyyMMdd contract date, the format of the old list; anything else is shown as it came. */
export function contractDateText(value: string | null | undefined): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value ?? '')
  if (!m) return value ?? ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[Number(m[2]) - 1]
  return month ? `${Number(m[3])}, ${month} ${m[1]}` : (value ?? '')
}
