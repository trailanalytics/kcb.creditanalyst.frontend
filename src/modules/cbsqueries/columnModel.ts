import type { Finding, ModuleColumn } from './types'

/** ok: the query produces it; missing: it does not (yet); unknown: the check could not say (no result yet, or the SQL is not readable). */
export type ColumnState = 'ok' | 'missing' | 'unknown'

/** Findings after which the select list cannot be read, so no column can be called present or missing. */
const UNREADABLE = new Set(['PARSE_ERROR', 'NOT_SELECT', 'STAR_SELECT'])

/** Findings that mean the expected alias named in `expectedAlias` is not produced yet. */
const ALIAS_NOT_PRODUCED = new Set(['MISSING_COLUMN', 'MISSING_ALIAS', 'WRONG_ALIAS'])

/** The column a `MISSING_COLUMN` message names, when the finding does not carry it: "Column `X` ...". */
function backticked(message: string): string | null {
  const m = /`([^`]+)`/.exec(message)
  return m ? (m[1] as string) : null
}

/**
 * A tick per expected column the query produces. A column is missing when a finding says so: MISSING_COLUMN for it, or a
 * missing or wrong alias whose expected alias is that column (the item exists but is not named for it). Without findings
 * (nothing validated yet) or when the SQL could not be read, every column is unknown rather than falsely ticked.
 */
export function columnStates(columns: ModuleColumn[], findings: Finding[] | null): Map<string, ColumnState> {
  const states = new Map<string, ColumnState>()
  const unreadable = findings === null || findings.some((f) => UNREADABLE.has(f.code))
  if (unreadable) {
    for (const c of columns) states.set(c.name, 'unknown')
    return states
  }
  const missing = new Set<string>()
  for (const f of findings) {
    if (!ALIAS_NOT_PRODUCED.has(f.code)) continue
    const name = f.expectedAlias ?? (f.code === 'MISSING_COLUMN' ? backticked(f.message) : null)
    if (name) missing.add(name.toUpperCase())
  }
  for (const c of columns) states.set(c.name, missing.has(c.name.toUpperCase()) ? 'missing' : 'ok')
  return states
}

/** "3 of 5 expected columns produced" for the panel heading; null while unknown. */
export function columnSummary(states: Map<string, ColumnState>): string | null {
  const all = [...states.values()]
  if (all.length === 0 || all.every((s) => s === 'unknown')) return null
  return `${all.filter((s) => s === 'ok').length} of ${all.length} expected columns produced`
}
