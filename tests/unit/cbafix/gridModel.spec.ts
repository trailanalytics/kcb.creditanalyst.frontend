import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import {
  buildSave,
  editedCount,
  failureText,
  highlightOf,
  invalidNumberCells,
  isEdited,
  isNumberText,
  markSaved,
  percentText,
  saveSummary,
  toRow,
  type GridRow,
} from '@/modules/cbafix/gridModel'
import type { CbaColumn } from '@/modules/cbafix/types'

const columns: CbaColumn[] = [
  { key: 'Borrowers_Client_Number', label: 'Borrowers Client Number', readonly: true, numeric: false },
  { key: 'Borrower_Classification', label: 'Borrower Classification', readonly: false, numeric: false },
  { key: 'Credit_Account_Reference', label: 'Credit Account Reference', readonly: true, numeric: false },
  { key: 'Credit_Amount', label: 'Credit Amount', readonly: false, numeric: true },
  { key: 'Term', label: 'Term', readonly: false, numeric: false },
]

const row = (id: number, ...values: (string | null)[]): GridRow => toRow({ id, values })

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

describe('rows', () => {
  it('shows NULL cells as empty text and starts with nothing edited', () => {
    const r = row(1, 'C1', null, 'REF1', '5000', '12')
    expect(r.values).toEqual(['C1', '', 'REF1', '5000', '12'])
    expect(r.original).toEqual(r.values)
    expect(editedCount([r])).toBe(0)
  })

  it('counts a cell as edited only while it differs from what was loaded, ignoring spaces', () => {
    const r = row(1, 'C1', '0', 'REF1', '5000', '12')
    r.values[3] = '6000'
    expect(isEdited(r, 3)).toBe(true)
    r.values[3] = ' 5000 '
    expect(isEdited(r, 3)).toBe(false)
    r.values[4] = ''
    expect(editedCount([r])).toBe(1)
  })
})

describe('the save body', () => {
  it('sends the two keys as loaded and only the edited cells, by name', () => {
    const edited = row(1, 'C1', '0', 'REF1', '5000', '12')
    edited.values[3] = '6000'
    edited.values[4] = '  24 '
    const untouched = row(2, 'C2', '0', 'REF2', '100', '6')
    expect(buildSave([edited, untouched], columns)).toEqual([
      { Credit_Account_Reference: 'REF1', Borrowers_Client_Number: 'C1', Credit_Amount: '6000', Term: '24' },
    ])
  })

  it('does not shift anything when columns are hidden: the rows are full width and the names travel with the values', () => {
    const r = row(1, 'C1', '0', 'REF1', '5000', '12')
    r.values[4] = '99'
    // the visible set plays no part: the body is built from the full row
    expect(buildSave([r], columns)[0]).toEqual({
      Credit_Account_Reference: 'REF1',
      Borrowers_Client_Number: 'C1',
      Term: '99',
    })
  })

  it('sends a cleared cell as empty text and never a read-only column', () => {
    const r = row(1, 'C1', '0', 'REF1', '5000', '12')
    r.values[1] = ''
    r.values[0] = 'CHANGED'
    expect(buildSave([r], columns)[0]).toEqual({
      Credit_Account_Reference: 'REF1',
      Borrowers_Client_Number: 'C1',
      Borrower_Classification: '',
    })
  })

  it('sends nothing when nothing was edited', () => {
    expect(buildSave([row(1, 'C1', '0', 'REF1', '5000', '12')], columns)).toEqual([])
  })

  it('after a save the edited rows count as loaded, except the accounts the server did not find', () => {
    const saved = row(1, 'C1', '0', 'REF1', '5000', '12')
    saved.values[3] = ' 7000 '
    const missing = row(2, 'C2', '0', 'REF2', '100', '6')
    missing.values[3] = '300'
    markSaved([saved, missing], columns, [{ reference: 'REF2', client: 'C2' }])
    expect(saved.values[3]).toBe('7000')
    expect(isEdited(saved, 3)).toBe(false)
    expect(isEdited(missing, 3)).toBe(true)
  })

  it('says which accounts were not saved', () => {
    expect(saveSummary({ updated: 2, unchanged: 0, unmatched: [], message: 'ok' })).toEqual({
      text: 'Changes saved successfully.',
      warning: false,
    })
    const s = saveSummary({
      updated: 1,
      unchanged: 0,
      unmatched: [{ reference: 'R9', client: 'C9' }],
      message: 'ok',
    })
    expect(s.warning).toBe(true)
    expect(s.text).toContain('R9')
  })
})

describe('number columns', () => {
  it('accept blank and anything Number reads, as the old grid did', () => {
    for (const ok of ['', ' ', '12', '12.50', '-3', '1e5']) expect(isNumberText(ok)).toBe(true)
    for (const bad of ['abc', '12a', '1,000', 'N/A']) expect(isNumberText(bad)).toBe(false)
  })

  it('lists the edited number cells that hold text, and ignores text columns and untouched cells', () => {
    const a = row(1, 'C1', '0', 'REF1', '5000', 'x')
    a.values[3] = 'about 5000'
    a.values[4] = 'twelve'
    const b = row(2, 'C2', '0', 'REF2', 'n/a', '6')
    expect(invalidNumberCells([a, b], columns)).toEqual([{ row: 0, col: 3 }])
  })
})

describe('highlighting', () => {
  it('marks the cell a rule is about and the cells it compares it with', () => {
    expect(highlightOf('CBA_106', 'Credit_Account_Closure_Date')).toBe('primary')
    expect(highlightOf('CBA_106', 'Credit_Account_Status')).toBe('related')
    expect(highlightOf('CBA_106', 'Term')).toBeNull()
    expect(highlightOf('CBA_353', 'Credit_Account_Date')).toBe('related')
  })

  it('marks nothing for rules about columns the grid does not show, or for no rule', () => {
    expect(highlightOf('CBA_103', 'Term')).toBeNull()
    expect(highlightOf('', 'Term')).toBeNull()
  })
})

describe('messages', () => {
  it('uses the validation messages of a 422, the text of another 4xx, and the fallback for a server error', () => {
    expect(
      failureText(
        failure(422, { detail: 'The given data was invalid.', errors: { a: ['First.'], b: ['Second.'] } }),
        'x',
      ),
    ).toBe('First. Second.')
    expect(failureText(failure(409, { detail: 'A CBA generation, cleanup or fix is running.' }), 'x')).toBe(
      'A CBA generation, cleanup or fix is running.',
    )
    expect(failureText(failure(500, { detail: 'boom' }), 'Failed to save changes. Please try again.')).toBe(
      'Failed to save changes. Please try again.',
    )
    expect(failureText(new Error('network'), 'fallback')).toBe('fallback')
  })

  it('prints percentages as the rule table does', () => {
    expect(percentText(0)).toBe('0%')
    expect(percentText(100)).toBe('100%')
    expect(percentText(33.33)).toBe('33.33%')
    expect(percentText(5.5)).toBe('5.50%')
  })
})
