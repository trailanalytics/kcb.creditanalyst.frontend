import type { OutputFileRow } from './types'

/** The server accepts rule names of 1 to 20 letters, digits, dashes and underscores. */
export const RULE_NAME = /^[A-Za-z0-9_-]{1,20}$/

export const REPORT_FILTER_TYPES = [
  ['bc', 'BC'],
  ['bs', 'BS'],
  ['cba', 'CBA'],
  ['cap', 'CAP'],
  ['ccg', 'CCG'],
  ['cmc', 'CMC'],
  ['ib', 'IB'],
  ['fra', 'FRA'],
  ['pi', 'PI'],
  ['pis', 'PIS'],
] as const

export function ruleNameProblem(rule: string): string | null {
  if (!rule.trim()) return 'Please enter the rule name.'
  return RULE_NAME.test(rule.trim())
    ? null
    : 'The rule name may only have letters, digits, dashes and underscores, up to 20 characters.'
}

export function extractProblem(input: {
  reportType: string
  ruleName: string
  file: File | null
}): string | null {
  if (!input.reportType) return 'Please select the report type.'
  if (!input.file) return 'Please choose the output file.'
  return ruleNameProblem(input.ruleName)
}

export function convertProblem(file: File | null): string | null {
  return file ? null : 'Please choose the Excel file.'
}

/** "( 12 days left )" for active rows, nothing for expired ones. */
export function timeLeftText(row: Pick<OutputFileRow, 'expired' | 'time_remaining'>): string {
  return row.expired || row.time_remaining === 'expired' ? '' : `( ${row.time_remaining} left )`
}

export const isExpired = (row: Pick<OutputFileRow, 'expired' | 'time_remaining'>) =>
  row.expired || row.time_remaining === 'expired'
