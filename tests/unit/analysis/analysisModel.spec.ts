import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import {
  ACTIONS,
  actionFor,
  isMonthEnd,
  numberWithCommas,
  pathOf,
  previousMonthEnd,
  resultLines,
  uploadBody,
  uploadFailureMessage,
  validateForm,
} from '@/modules/analysis/analysisModel'
import type { AnalysisResults } from '@/modules/analysis/types'

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

const file = new File(['a,b'], 'pr4.csv', { type: 'text/csv' })

describe('reporting month', () => {
  it('defaults to the last day of the previous month, leap years and year ends included', () => {
    expect(previousMonthEnd(new Date(2026, 9, 24))).toBe('2026-09-30')
    expect(previousMonthEnd(new Date(2026, 2, 31))).toBe('2026-02-28')
    expect(previousMonthEnd(new Date(2028, 2, 15))).toBe('2028-02-29')
    expect(previousMonthEnd(new Date(2026, 0, 5))).toBe('2025-12-31')
  })

  it('accepts only the last day of a month', () => {
    for (const ok of ['2026-09-30', '2026-02-28', '2028-02-29', '2026-12-31'])
      expect(isMonthEnd(ok)).toBe(true)
    for (const bad of ['2026-09-15', '2026-02-29', '2026-09-31', 'x', '']) expect(isMonthEnd(bad)).toBe(false)
  })
})

describe('form checks', () => {
  const good = { reportingMonth: '2026-09-30', exchangeRate: '3765', file }

  it('reports the first problem, in the order of the old page', () => {
    expect(validateForm(good)).toBeNull()
    expect(validateForm({ reportingMonth: null, exchangeRate: '', file: null })).toBe(
      'Please make sure the submission date is selected!',
    )
    expect(validateForm({ reportingMonth: '2026-09-15', exchangeRate: '', file: null })).toBe(
      'Submission date must be the last day of a month (e.g. 31 Mar, 30 Apr).',
    )
    expect(validateForm({ ...good, exchangeRate: '' })).toBe(
      'Please enter a valid exchange rate greater than 0!',
    )
    expect(validateForm({ ...good, exchangeRate: '0' })).toBe(
      'Please enter a valid exchange rate greater than 0!',
    )
    expect(validateForm({ ...good, exchangeRate: '-3' })).toBe(
      'Please enter a valid exchange rate greater than 0!',
    )
    expect(validateForm({ ...good, file: null })).toBe('Please make sure the PR4 file is attached!')
    expect(validateForm({ ...good, exchangeRate: '0.0001' })).toBeNull()
  })

  it('falls back to the first action when none is chosen', () => {
    expect(actionFor('')).toBe(ACTIONS[0])
    expect(actionFor('analyse_pr4').analyze).toBe(true)
    expect(actionFor('update_cba').analyze).toBe(false)
  })

  it('sends the four fields with analyze as text', () => {
    const body = uploadBody(good, ACTIONS[1]!)
    expect(body.get('reporting_month')).toBe('2026-09-30')
    expect(body.get('exchange_rate')).toBe('3765')
    expect(body.get('analyze')).toBe('true')
    expect((body.get('file') as File).name).toBe('pr4.csv')
    expect(uploadBody(good, ACTIONS[0]!).get('analyze')).toBe('false')
  })
})

describe('failed uploads', () => {
  it('shows the first validation message and how many more there are', () => {
    const errors = {
      file: ['The file field is required.'],
      exchange_rate: ['The exchange rate field is required.'],
      reporting_month: ['The reporting month field is required.'],
    }
    expect(uploadFailureMessage(failure(422, { detail: 'The given data was invalid.', errors }))).toBe(
      'The file field is required. (and 2 more errors)',
    )
    expect(
      uploadFailureMessage(failure(422, { errors: { ...errors, reporting_month: [] }, detail: 'x' })),
    ).toBe('The file field is required. (and 1 more error)')
    expect(uploadFailureMessage(failure(422, { errors: { file: ['The file field is required.'] } }))).toBe(
      'The file field is required.',
    )
  })

  it('shows the text of a 409 or a 500 and a generic line when there is none', () => {
    expect(
      uploadFailureMessage(
        failure(409, { detail: 'A PR4 upload for this reporting month is already pending or processing.' }),
      ),
    ).toBe('A PR4 upload for this reporting month is already pending or processing.')
    expect(
      uploadFailureMessage(
        failure(500, {
          detail: 'Something went wrong while uploading the file! Please contact IT for support.',
        }),
      ),
    ).toBe('Something went wrong while uploading the file! Please contact IT for support.')
    expect(uploadFailureMessage(failure(413, undefined))).toBe(
      'An error occurred while uploading. Please try again.',
    )
    expect(uploadFailureMessage(new Error('network'))).toBe(
      'An error occurred while uploading. Please try again.',
    )
  })
})

describe('links and numbers', () => {
  it('takes the path of the background processes link whatever host the API saw', () => {
    expect(pathOf('https://credit.kcb.test/background-processes')).toBe('/background-processes')
    expect(pathOf('/background-processes')).toBe('/background-processes')
  })

  it('puts separators in counts', () => {
    expect(numberWithCommas('12345')).toBe('12,345')
    expect(numberWithCommas('999')).toBe('999')
    expect(numberWithCommas(1234567)).toBe('1,234,567')
    expect(numberWithCommas('0')).toBe('0')
  })
})

describe('result lines', () => {
  const results: AnalysisResults = {
    id: 1,
    pr4_records_count: '12500',
    cba_records_count: '98765',
    matching_records_count: '12000',
    matching_records_percentage: '96',
    balance_records_count: '12500',
    balance_records_percentage: '100',
    matching_balance_count: '11000',
    matching_balance_percentage: '91.67',
    installment_records_count: '12500',
    installment_records_percentage: '100',
    matching_installment_count: '10000',
    matching_installment_percentage: '83.33',
    arrears_records_count: '12500',
    arrears_records_percentage: '100',
    matching_arrears_count: '11900',
    matching_arrears_percentage: '99.17',
    pr4_float_loans_records_count: '500',
    pr4_float_loans_records_percentage: '4',
  }
  const text = (i: number) =>
    resultLines(results)
      [i]!.parts.map((p) => p.text)
      .join('')

  it('reads like the old page', () => {
    expect(resultLines(results)).toHaveLength(6)
    expect(text(0)).toBe('12,500 records found in the Pr4 File compared against 98,765 records in the CBA.')
    expect(text(1)).toBe('12,000 (96%) records found in the Pr4 File were also found in the CBA.')
    expect(text(2)).toBe(
      '12,500 (100%) records found in the Pr4 have a balance, of these, 11,000 (91.67%) have identical balances of the same record in the CBA.',
    )
    expect(text(3)).toBe(
      '12,500 (100%) records found in the Pr4 have installment amount, of these, 10,000 (83.33%) have identical installment amount of the same record in the CBA.',
    )
    expect(text(4)).toBe(
      '12,500 (100%) records found in the Pr4 are in arrears, of these, 11,900 (99.17%) have identical arrears days and amounts of the same record in the CBA.',
    )
    expect(text(5)).toBe(
      '12,500 records found in the Pr4 File, of these, 500 (4%) are KCB AIRTEL AGENT FLOAT LOAN and are not reported in the CBA.',
    )
  })

  it('marks the numbers bold, the float line red, and the dividers after the second and fifth', () => {
    const lines = resultLines(results)
    expect(lines[0]!.parts.filter((p) => p.bold).map((p) => p.text)).toEqual(['12,500', '98,765'])
    expect(lines[1]!.parts.filter((p) => p.bold).map((p) => p.text)).toEqual(['12,000', '96%'])
    expect(lines.map((l) => Boolean(l.danger))).toEqual([false, false, false, false, false, true])
    expect(lines.map((l) => Boolean(l.divider))).toEqual([false, true, false, false, true, false])
  })
})
