import { describe, expect, it } from 'vitest'
import {
  convertProblem,
  extractProblem,
  isExpired,
  ruleNameProblem,
  timeLeftText,
} from '@/modules/reports/outputModel'
import {
  accountName,
  codeLine,
  contractDateText,
  money,
  visibleSections,
} from '@/modules/reports/analysisModel'

describe('rule names', () => {
  it.each(['CBA_399', 'CAP-221', 'a', 'A'.repeat(20)])('accepts %s', (r) => {
    expect(ruleNameProblem(r)).toBeNull()
  })

  it.each(['', '  ', '../x', 'a b', 'CBA/399', 'A'.repeat(21), 'rule.xlsx'])('refuses "%s"', (r) => {
    expect(ruleNameProblem(r)).not.toBeNull()
  })

  it('checks the report type and file before the rule', () => {
    const file = new File(['x'], 'f.csv')
    expect(extractProblem({ reportType: '', ruleName: 'CBA_1', file })).toMatch(/report type/)
    expect(extractProblem({ reportType: 'cba', ruleName: 'CBA_1', file: null })).toMatch(/output file/)
    expect(extractProblem({ reportType: 'cba', ruleName: 'bad rule', file })).toMatch(/rule name/i)
    expect(extractProblem({ reportType: 'cba', ruleName: 'CBA_1', file })).toBeNull()
    expect(convertProblem(null)).toMatch(/Excel/)
    expect(convertProblem(new File(['x'], 'f.xlsx'))).toBeNull()
  })
})

describe('time left', () => {
  it('shows the remaining time of an active file and nothing for an expired one', () => {
    expect(timeLeftText({ expired: false, time_remaining: '12 days' })).toBe('( 12 days left )')
    expect(timeLeftText({ expired: false, time_remaining: '5 hrs' })).toBe('( 5 hrs left )')
    expect(timeLeftText({ expired: true, time_remaining: 'expired' })).toBe('')
    expect(isExpired({ expired: false, time_remaining: 'expired' })).toBe(true)
  })
})

describe('analysis formatting', () => {
  it('writes counts and amounts with thousands separators and no decimals', () => {
    expect(money(1234567.89)).toBe('1,234,568')
    expect(money('5000000')).toBe('5,000,000')
    expect(money(null)).toBe('0')
  })

  it('shows a section only when its count is above zero', () => {
    const s = visibleSections({
      stakeholders: { count: 3 },
      bounced_cheques: { count: 0 },
      credit_applications: { count: 1 },
      credit_accounts: { count: 0 },
    })
    expect(s).toEqual({ stakeholders: true, bounced: false, applications: true, accounts: false })
  })

  it('formats the code line, names and contract dates', () => {
    expect(codeLine('001')).toBe('code: 001')
    expect(codeLine(null)).toBe('code: ')
    expect(accountName('  ')).toBe('Unnamed customer')
    expect(accountName(' Okello James ')).toBe('Okello James')
    expect(contractDateText('20250905')).toBe('5, Sep 2025')
    expect(contractDateText('garbage')).toBe('garbage')
    expect(contractDateText('20251305')).toBe('20251305')
  })
})
