import dayjs from 'dayjs'
import type { Application, LoanModel } from './types'

/** Blank loan section: today's date, UGX and a term of 0 months, as the Blade form started. */
export function emptyLoan(): LoanModel {
  return {
    creditApplicationDate: dayjs().format('YYYY-MM-DD'),
    creditApplicationReference: '',
    currency: 'UGX',
    amount: null,
    CreditAccountLoanProductType: '',
    Term: '0',
    Term_Period: '',
    loanPurpose: '',
    branch: '',
    jointAccountNumber: '',
    restructuredAccountNumber: '',
  }
}

/** The loan section of an existing application (edit). */
export function loanFrom(a: Application): LoanModel {
  const d = a.creditApplicationDate ?? ''
  return {
    ...emptyLoan(),
    creditApplicationDate: /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '',
    creditApplicationReference: a.creditApplicationReference,
    currency: a.currency ?? 'UGX',
    amount: a.Amount === null || a.Amount === '' ? null : Number(a.Amount),
    CreditAccountLoanProductType: a.creditAccountLoanProductType ?? '',
    Term: a.Term ?? '0',
    Term_Period: a.TermPeriod ?? '',
    loanPurpose: a.loanPurpose ?? '',
    branch: a.branchCode ?? '',
    jointAccountNumber: a.jointAccountNumber ?? '',
  }
}

/** Fields of the loan section that are required (`required` attribute in the Blade form). */
export const LOAN_REQUIRED: (keyof LoanModel)[] = [
  'CreditAccountLoanProductType',
  'Term_Period',
  'loanPurpose',
  'branch',
]

export function checkLoan(l: LoanModel): string[] {
  return LOAN_REQUIRED.filter((f) => String(l[f] ?? '').trim() === '')
}

/** Status label of the list and header: 2 Pending, 0 Approved, anything else Rejected. */
export function statusLabel(status: string | null | undefined): string {
  return status === '2' ? 'Pending' : status === '0' ? 'Approved' : 'Rejected'
}

/** "12 Months" / "1 Year". */
export function termText(term: string | null, period: string | null): string {
  const n = Number(term)
  return `${term ?? ''} ${period ?? ''}${n > 1 ? 's' : ''}`.trim()
}

/** yyyymmdd -> dd/mm/yyyy ('' when it is not one). */
export function crbToDisplay(d: string | null | undefined): string {
  return d && /^\d{8}$/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : (d ?? '')
}

/** yyyymmdd -> "23 Oct 2026". */
export function crbToLong(d: string | null | undefined): string {
  return d && /^\d{8}$/.test(d)
    ? dayjs(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).format('D MMM YYYY')
    : (d ?? '')
}
