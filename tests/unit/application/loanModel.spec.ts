import { describe, expect, it } from 'vitest'
import {
  checkLoan,
  crbToDisplay,
  crbToLong,
  emptyLoan,
  loanFrom,
  statusLabel,
  termText,
} from '@/modules/application/loanModel'
import type { Application } from '@/modules/application/types'

describe('loan model', () => {
  it('starts with today, UGX and a term of zero', () => {
    const l = emptyLoan()
    expect(l.currency).toBe('UGX')
    expect(l.Term).toBe('0')
    expect(l.creditApplicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('names the four required selects that are still empty', () => {
    expect(checkLoan(emptyLoan())).toEqual([
      'CreditAccountLoanProductType',
      'Term_Period',
      'loanPurpose',
      'branch',
    ])
    const l = {
      ...emptyLoan(),
      CreditAccountLoanProductType: '2',
      Term_Period: 'Month',
      loanPurpose: '1',
      branch: '001',
    }
    expect(checkLoan(l)).toEqual([])
  })

  it('turns a saved application into the form values', () => {
    const l = loanFrom({
      creditApplicationReference: 'KCB/CAP/202610/000001',
      creditApplicationDate: '20261023',
      Amount: '5000000.00',
      currency: 'USD',
      creditAccountLoanProductType: '2',
      Term: '12',
      TermPeriod: 'Month',
      loanPurpose: '1',
      branchCode: '001',
      jointAccountNumber: null,
    } as Application)
    expect(l).toMatchObject({
      creditApplicationDate: '2026-10-23',
      amount: 5000000,
      currency: 'USD',
      Term_Period: 'Month',
      branch: '001',
    })
  })

  it('labels statuses the way the list does', () => {
    expect([statusLabel('2'), statusLabel('0'), statusLabel('5'), statusLabel(null)]).toEqual([
      'Pending',
      'Approved',
      'Rejected',
      'Rejected',
    ])
  })

  it('pluralises the term and formats CRB dates', () => {
    expect(termText('12', 'Month')).toBe('12 Months')
    expect(termText('1', 'Year')).toBe('1 Year')
    expect(crbToDisplay('20261023')).toBe('23/10/2026')
    expect(crbToLong('20261023')).toBe('23 Oct 2026')
    expect(crbToDisplay('soon')).toBe('soon')
  })
})
