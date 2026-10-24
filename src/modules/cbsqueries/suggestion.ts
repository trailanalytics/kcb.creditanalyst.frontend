import type { Finding } from './types'

export interface Applied {
  sql: string
  /** Where the caret goes: just after the text that was put in. */
  caret: number
}

/** A row offers "Apply suggestion" when it names an alias and says where it goes (an offset) or what it replaces (found text). */
export function canApplySuggestion(
  f: Pick<Finding, 'expectedAlias' | 'suggestedOffset' | 'foundText'>,
): boolean {
  if (!f.expectedAlias) return false
  return f.suggestedOffset !== null || Boolean(f.foundText)
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Apply one finding's suggestion to the SQL it was found in (pure):
 * - a missing alias (`suggestedOffset` set): insert ` AS <expectedAlias>` at that offset;
 * - a wrong alias (no offset, `foundText` set): replace the alias text with `expectedAlias`, preferring the occurrence
 *   written as `AS <alias>`, else the first whole-word occurrence.
 * Returns null when there is nothing to apply, or when the SQL no longer matches the finding (offset out of range, text gone).
 */
export function applySuggestion(sql: string, f: Finding): Applied | null {
  if (!canApplySuggestion(f)) return null
  const alias = f.expectedAlias as string

  if (f.suggestedOffset !== null) {
    if (f.suggestedOffset < 0 || f.suggestedOffset > sql.length) return null
    const insert = ` AS ${alias}`
    return {
      sql: sql.slice(0, f.suggestedOffset) + insert + sql.slice(f.suggestedOffset),
      caret: f.suggestedOffset + insert.length,
    }
  }

  const found = f.foundText as string
  const word = escapeRegExp(found)
  // a trailing identifier character means the match is only the front of a longer name
  const tail = '(?![A-Za-z0-9_$#])'
  const candidates = [
    new RegExp(`(\\bAS\\s+)${word}${tail}`),
    new RegExp(`(\\bAS\\s+)${word}${tail}`, 'i'),
    new RegExp(`(?<![A-Za-z0-9_$#.])()${word}${tail}`),
    new RegExp(`(?<![A-Za-z0-9_$#.])()${word}${tail}`, 'i'),
  ]
  for (const re of candidates) {
    const m = re.exec(sql)
    if (!m) continue
    const start = m.index + (m[1] ?? '').length
    return { sql: sql.slice(0, start) + alias + sql.slice(start + found.length), caret: start + alias.length }
  }
  return null
}
