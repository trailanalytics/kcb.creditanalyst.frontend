import axios from 'axios'
import { problemOf } from '@/api/http'
import type { SaveAccount } from './api'
import type { CbaColumn, SaveResult, Unmatched } from './types'

/** The two columns that find a row on the server; they are shown but cannot be edited. */
export const REFERENCE = 'Credit_Account_Reference'
export const CLIENT = 'Borrowers_Client_Number'

export const PAGE_SIZES = [10, 20, 50, 100] as const

export const DSM_URL = '/templates/dsm-final-v8-final-clean-11062023.pdf'

/** A grid row as the page keeps it: what is shown, and what the server sent (to tell what was edited). */
export interface GridRow {
  id: number
  values: string[]
  original: string[]
}

/** The cells of a rule the grid can show: the offending column(s) first, the ones the rule compares them with after. */
export interface RuleColumns {
  primary: string[]
  related: string[]
}

/** Rules that are about columns the grid does not show (group code, old account number ...) are not listed. */
export const RULE_COLUMNS: Record<string, RuleColumns> = {
  CBA_023: { primary: ['Current_Balance_Amount'], related: [] },
  CBA_106: { primary: ['Credit_Account_Closure_Date'], related: ['Credit_Account_Status'] },
  CBA_107: { primary: ['Credit_Account_Closure_Reason'], related: ['Credit_Account_Status'] },
  CBA_278: {
    primary: ['Monthly_Instalment_Amount'],
    related: ['Credit_Account_Type', 'Credit_Amount', 'Term'],
  },
  CBA_282: { primary: ['Credit_Account_Arrears_Date'], related: ['Credit_Account_Status'] },
  CBA_296: {
    primary: ['Credit_Amount_UGX_Equivalent'],
    related: ['Currency', 'Credit_Amount'],
  },
  CBA_298: {
    primary: ['Credit_Amount_Drawdown_UGX_Equivalent'],
    related: ['Currency', 'Credit_Amount_Drawdown'],
  },
  CBA_299: {
    primary: ['Current_Balance_Amount_UGX_Equivalent'],
    related: ['Currency', 'Current_Balance_Amount'],
  },
  CBA_353: { primary: ['Transaction_Date'], related: ['Credit_Account_Date'] },
  CBA_356: { primary: ['Last_Payment_Date'], related: ['Credit_Account_Date'] },
  CBA_362: {
    primary: ['Credit_Account_Arrears_Date'],
    related: ['Credit_Account_Date', 'Credit_Account_Status'],
  },
  CBA_364: { primary: ['Credit_Account_Arrears_Date'], related: ['Credit_Account_Status'] },
  CBA_366: { primary: ['Current_Balance_Amount'], related: ['Credit_Account_Status'] },
  CBA_372: { primary: ['Credit_Account_Closure_Date'], related: ['Credit_Account_Status'] },
  CBA_401: { primary: ['Maturity_Date'], related: ['Credit_Account_Status'] },
  CBA_429: { primary: ['Credit_Account_Date'], related: ['Maturity_Date'] },
}

export type Highlight = 'primary' | 'related' | null

/** How a cell is marked while the rows of a rule are shown. */
export function highlightOf(rule: string, columnKey: string): Highlight {
  const cols = RULE_COLUMNS[rule]
  if (!cols) return null
  if (cols.primary.includes(columnKey)) return 'primary'
  return cols.related.includes(columnKey) ? 'related' : null
}

/** Rule ids the screen shows a rule without cells for (hidden columns), so the user knows why nothing is marked. */
export function ruleHasVisibleColumns(rule: string): boolean {
  return rule in RULE_COLUMNS
}

export function toRow(row: { id: number; values: (string | null)[] }): GridRow {
  const values = row.values.map((v) => v ?? '')
  return { id: row.id, values: [...values], original: [...values] }
}

/** What the server will store for a cell: trimmed text; empty text becomes NULL there. */
function normal(value: string): string {
  return value.trim()
}

export function isEdited(row: GridRow, col: number): boolean {
  return normal(row.values[col] ?? '') !== normal(row.original[col] ?? '')
}

/** Text the number columns accept: nothing, or anything `Number` reads (decimals and negatives pass, as they did). */
export function isNumberText(value: string): boolean {
  return value.trim() === '' || !Number.isNaN(Number(value))
}

export function editedCount(rows: GridRow[]): number {
  let n = 0
  for (const row of rows) for (let c = 0; c < row.values.length; c++) if (isEdited(row, c)) n++
  return n
}

export interface BadCell {
  row: number
  col: number
}

/** Edited cells of the number columns that do not hold a number; the save is refused while there are any. */
export function invalidNumberCells(rows: GridRow[], columns: CbaColumn[]): BadCell[] {
  const bad: BadCell[] = []
  rows.forEach((row, r) =>
    columns.forEach((column, c) => {
      if (column.numeric && isEdited(row, c) && !isNumberText(row.values[c] ?? ''))
        bad.push({ row: r, col: c })
    }),
  )
  return bad
}

/** The body of the save: for every edited row its two keys (as loaded) and the edited cells by name. Nothing else is sent. */
export function buildSave(rows: GridRow[], columns: CbaColumn[]): SaveAccount[] {
  const refCol = columns.findIndex((c) => c.key === REFERENCE)
  const clientCol = columns.findIndex((c) => c.key === CLIENT)
  const accounts: SaveAccount[] = []
  for (const row of rows) {
    const cells: SaveAccount = {}
    columns.forEach((column, c) => {
      if (column.readonly || !isEdited(row, c)) return
      cells[column.key] = normal(row.values[c] ?? '')
    })
    if (Object.keys(cells).length === 0) continue
    accounts.push({
      [REFERENCE]: row.original[refCol] ?? '',
      [CLIENT]: row.original[clientCol] ?? '',
      ...cells,
    })
  }
  return accounts
}

/** After a save the rows that were written count as loaded: the server's copy equals what is shown. */
export function markSaved(rows: GridRow[], columns: CbaColumn[], unmatched: Unmatched[]): void {
  const refCol = columns.findIndex((c) => c.key === REFERENCE)
  const skip = new Set(unmatched.map((u) => u.reference))
  for (const row of rows) {
    if (skip.has(row.original[refCol] ?? '')) continue
    row.values = row.values.map((v) => normal(v))
    row.original = [...row.values]
  }
}

/** What to tell the user after a save: the server's message, and the accounts it could not find. */
export function saveSummary(result: SaveResult): { text: string; warning: boolean } {
  if (result.unmatched.length === 0) return { text: 'Changes saved successfully.', warning: false }
  const refs = result.unmatched.map((u) => u.reference).join(', ')
  return {
    text: `Saved ${result.updated} account(s). Not found in the CBA, not saved: ${refs}.`,
    warning: true,
  }
}

/** The message of a failed request: the server's text, or the fallback. */
export function failureText(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const problem = problemOf(e)
    if (e.response?.status === 422 && problem?.errors) {
      const messages = Object.values(problem.errors).flat()
      if (messages.length > 0) return messages.slice(0, 3).join(' ')
    }
    if (problem?.detail && e.response && e.response.status < 500) return problem.detail
  }
  return fallback
}

/** "33.33" -> "33.33%", whole numbers print without decimals. */
export function percentText(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`
}

export function lastPage(page: { current_page: number; last_page: number }): boolean {
  return page.current_page >= page.last_page
}
