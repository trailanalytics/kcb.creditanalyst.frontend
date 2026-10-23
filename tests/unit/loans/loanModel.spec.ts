import { describe, expect, it } from 'vitest'
import {
  blankForceClose,
  creditCardSummary,
  filledClients,
  isBlankRow,
  parseContractCodes,
  removeRow,
  rowErrorLines,
  statusText,
} from '@/modules/loans/loanModel'

describe('loan model', () => {
  it('names the statuses the loan lists show and nothing else', () => {
    expect(['5', '4', '3', '6', '1'].map(statusText)).toEqual([
      'Current',
      'Closed',
      'Written Off',
      'Written Off Recovery',
      'Overdue',
    ])
    expect(statusText('2')).toBe('')
    expect(statusText(null)).toBe('')
  })

  it('splits the Add Accounts text on commas and line breaks and drops empty pieces', () => {
    expect(parseContractCodes(' AA1, AA2 ,,\nAA3\r\n, ')).toEqual(['AA1', 'AA2', 'AA3'])
    expect(parseContractCodes('   ')).toEqual([])
  })

  it('removes a force close row without moving the values of the rows after it', () => {
    const rows = ['A', 'B', 'C'].map((c) => ({ ...blankForceClose(), contractCode: c }))
    expect(removeRow(rows, 1).map((r) => r.contractCode)).toEqual(['A', 'C'])
    expect(isBlankRow(blankForceClose())).toBe(true)
    expect(isBlankRow({ ...blankForceClose(), lastPaymentAmount: '10' })).toBe(false)
  })

  it('points each force close error at its row', () => {
    expect(
      rowErrorLines({
        'accounts.1.contractCode': ['No loan account was found for X.'],
        'accounts.0.lastPaymentDate': ['bad'],
        accounts: ['No loan accounts supplied!'],
      }),
    ).toEqual(['Row 2: No loan account was found for X.', 'Row 1: bad', 'No loan accounts supplied!'])
    expect(rowErrorLines(undefined)).toEqual([])
  })

  it('keeps only the client numbers that contain a digit, trimmed, with their item', () => {
    expect(filledClients({ 5: ' 100234 ', 6: '', 7: 'abc', 8: 'C-77' })).toEqual([
      { id: 5, clientNumber: '100234' },
      { id: 8, clientNumber: 'C-77' },
    ])
  })

  it('escapes what the server sent and lists unknown clients under the count', () => {
    const html = creditCardSummary({
      message: '2 Credit Cards Uploaded Successfully',
      not_found: ['<b>1</b>', '2'],
      skipped: ['Row 3: AA1 already belongs to another client'],
    })
    expect(html).toContain('2 Credit Cards Uploaded Successfully')
    expect(html).toContain('Client Numbers: &lt;b&gt;1&lt;/b&gt;, 2 could not find corresponding customers.')
    expect(html).toContain('Row 3: AA1 already belongs to another client')
    expect(html).not.toContain('<b>1</b>')
    expect(creditCardSummary({ message: 'ok', not_found: [], skipped: [] })).toBe('ok')
  })
})
