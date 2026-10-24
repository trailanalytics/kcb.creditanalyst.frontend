import { describe, expect, it } from 'vitest'
import { applySuggestion, canApplySuggestion } from '@/modules/cbsqueries/suggestion'
import { finding } from './fixtures'

describe('canApplySuggestion', () => {
  it('needs an expected alias and either an offset or the found text', () => {
    expect(canApplySuggestion(finding({ expectedAlias: 'CUS_ID', suggestedOffset: 10 }))).toBe(true)
    expect(canApplySuggestion(finding({ expectedAlias: 'CUS_ID', foundText: 'CUSID' }))).toBe(true)
    expect(canApplySuggestion(finding({ expectedAlias: null, suggestedOffset: 10 }))).toBe(false)
    expect(canApplySuggestion(finding({ expectedAlias: 'CUS_ID' }))).toBe(false)
  })
})

describe('applySuggestion for a missing alias', () => {
  const sql = 'SELECT A.CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A'

  it('inserts " AS <alias>" at the offset and puts the caret after it', () => {
    const offset = 'SELECT A.CUS_ID'.length
    const result = applySuggestion(sql, finding({ expectedAlias: 'CUS_ID', suggestedOffset: offset }))
    expect(result?.sql).toBe('SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A')
    expect(result?.caret).toBe(offset + ' AS CUS_ID'.length)
  })

  it('works at the start and the end of the text', () => {
    expect(applySuggestion('X', finding({ expectedAlias: 'A', suggestedOffset: 0 }))?.sql).toBe(' AS AX')
    expect(applySuggestion('X', finding({ expectedAlias: 'A', suggestedOffset: 1 }))?.sql).toBe('X AS A')
  })

  it('refuses an offset outside the text, which means the text changed since the check', () => {
    expect(applySuggestion('X', finding({ expectedAlias: 'A', suggestedOffset: 5 }))).toBeNull()
    expect(applySuggestion('X', finding({ expectedAlias: 'A', suggestedOffset: -1 }))).toBeNull()
  })

  it('counts a multi-line text by characters, newlines included', () => {
    const text = 'SELECT A.CUS_ID,\n       A.CUS_NAME\nFROM T A'
    const offset = text.indexOf('A.CUS_NAME') + 'A.CUS_NAME'.length
    const result = applySuggestion(text, finding({ expectedAlias: 'CUS_NAME', suggestedOffset: offset }))
    expect(result?.sql).toBe('SELECT A.CUS_ID,\n       A.CUS_NAME AS CUS_NAME\nFROM T A')
  })
})

describe('applySuggestion for a wrong alias', () => {
  it('replaces the found alias that follows AS', () => {
    const sql = 'SELECT A.ID AS CUSID, A.NAME AS CUS_NAME FROM T A'
    const result = applySuggestion(
      sql,
      finding({ code: 'WRONG_ALIAS', foundText: 'CUSID', expectedAlias: 'CUS_ID' }),
    )
    expect(result?.sql).toBe('SELECT A.ID AS CUS_ID, A.NAME AS CUS_NAME FROM T A')
    expect(result?.caret).toBe('SELECT A.ID AS CUS_ID'.length)
  })

  it('prefers the alias position over an earlier identical word in the expression', () => {
    const sql = 'SELECT NAME_X.NAME AS NAME FROM T NAME_X'
    const result = applySuggestion(
      sql,
      finding({ code: 'WRONG_ALIAS', foundText: 'NAME', expectedAlias: 'CUS_NAME' }),
    )
    expect(result?.sql).toBe('SELECT NAME_X.NAME AS CUS_NAME FROM T NAME_X')
  })

  it('does not touch a longer name that only starts with the found text', () => {
    const sql = 'SELECT A.ID AS CUS_ID, A.X AS CUS FROM T A'
    const result = applySuggestion(
      sql,
      finding({ code: 'WRONG_ALIAS', foundText: 'CUS', expectedAlias: 'CUS_NAME' }),
    )
    expect(result?.sql).toBe('SELECT A.ID AS CUS_ID, A.X AS CUS_NAME FROM T A')
  })

  it('matches the keyword and the alias without regard to case, and replaces a quoted alias with its quotes', () => {
    const result = applySuggestion(
      'select a.id as "CusId" from t a',
      finding({ code: 'ALIAS_CASE', severity: 'INFO', foundText: '"CusId"', expectedAlias: 'CUS_ID' }),
    )
    expect(result?.sql).toBe('select a.id as CUS_ID from t a')
  })

  it('falls back to the first whole word when the alias is not written with AS', () => {
    const result = applySuggestion(
      'SELECT A.ID CUSID FROM T A',
      finding({ code: 'WRONG_ALIAS', foundText: 'CUSID', expectedAlias: 'CUS_ID' }),
    )
    expect(result?.sql).toBe('SELECT A.ID CUS_ID FROM T A')
  })

  it('returns null when the found text is gone', () => {
    expect(
      applySuggestion('SELECT 1 AS X FROM DUAL', finding({ foundText: 'CUSID', expectedAlias: 'CUS_ID' })),
    ).toBeNull()
  })

  it('returns null when there is no suggestion to apply', () => {
    expect(applySuggestion('SELECT 1', finding({ expectedAlias: null, foundText: 'X' }))).toBeNull()
  })
})
