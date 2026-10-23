import { describe, expect, it } from 'vitest'
import {
  ageError,
  checkParty,
  fcsNumberError,
  MSG_AGE,
  MSG_FCS,
  MSG_NIN,
  MSG_PERCENTAGE,
  ninError,
  percentageError,
} from '@/modules/securities/checks'
import { MSG_REQUIRED } from '@/modules/customer/profileRules'
import { completeParty } from './fixtures'

const at = (year: number) => new Date(year, 5, 15)

describe('fcsNumberError', () => {
  it('accepts exactly 13 characters', () => {
    expect(fcsNumberError({ II_FCSNumber: '1234567890123' })).toBeNull()
    expect(fcsNumberError({ II_FCSNumber: ' 1234567890123 ' })).toBeNull()
    expect(fcsNumberError({ II_FCSNumber: '123456789012' })).toBe(MSG_FCS)
    expect(fcsNumberError({ II_FCSNumber: '12345678901234' })).toBe(MSG_FCS)
    expect(fcsNumberError({ II_FCSNumber: '' })).toBe(MSG_FCS)
  })
})

describe('ninError', () => {
  it('needs 14 characters for an individual whose ID was issued in Uganda', () => {
    const m = { classificationCode: '0', II_CountryOfIssue: 'UG', II_CountryID: 'CM88000000ABC' }
    expect(ninError(m)).toBe(MSG_NIN)
    expect(ninError({ ...m, II_CountryID: 'CM88000000ABCD' })).toBeNull()
  })

  it('leaves foreign documents and companies alone', () => {
    expect(ninError({ classificationCode: '0', II_CountryOfIssue: 'KE', II_CountryID: '1' })).toBeNull()
    expect(ninError({ classificationCode: '1', II_CountryOfIssue: 'UG', II_CountryID: '' })).toBeNull()
  })

  it('treats a missing classification as an individual', () => {
    expect(ninError({ II_CountryOfIssue: 'UG', II_CountryID: '1' })).toBe(MSG_NIN)
  })
})

describe('ageError', () => {
  it('counts by year of birth only', () => {
    expect(ageError({ classificationCode: '0', GSCAFB_YearOfBirth: '2010' }, at(2026))).toBeNull() // 16 by year
    expect(ageError({ classificationCode: '0', GSCAFB_YearOfBirth: '2011' }, at(2026))).toBe(MSG_AGE)
    expect(ageError({ classificationCode: '0', GSCAFB_YearOfBirth: '1990' }, at(2026))).toBeNull()
  })

  it('does not apply to companies', () => {
    expect(ageError({ classificationCode: '1', GSCAFB_YearOfBirth: '' }, at(2026))).toBeNull()
  })
})

describe('percentageError', () => {
  it('allows up to 100', () => {
    expect(percentageError('100')).toBeNull()
    expect(percentageError('99.5')).toBeNull()
    expect(percentageError('100.1')).toBe(MSG_PERCENTAGE)
    expect(percentageError('250')).toBe(MSG_PERCENTAGE)
  })
})

describe('checkParty', () => {
  it('passes a complete guarantor and a complete stakeholder', () => {
    expect(checkParty(completeParty('guarantor'), 'guarantor', at(2026))).toEqual({
      invalid: [],
      message: null,
    })
    expect(checkParty(completeParty('stakeholder'), 'stakeholder', at(2026))).toEqual({
      invalid: [],
      message: null,
    })
  })

  it('asks for the modal fields before anything else, with the red-border message', () => {
    const m = completeParty('guarantor')
    m.GuaranteeType = ''
    m.branchCode = ''
    m.II_FCSNumber = '1' // would also fail, but the required fields come first
    const check = checkParty(m, 'guarantor', at(2026))
    expect(check.message).toBe(MSG_REQUIRED)
    expect(check.invalid).toEqual(expect.arrayContaining(['branchCode', 'GuaranteeType']))
  })

  it('does not require guarantor fields on a stakeholder', () => {
    const m = completeParty('stakeholder')
    expect(checkParty(m, 'stakeholder', at(2026)).message).toBeNull()
    m.ShareholderPercentage = ''
    expect(checkParty(m, 'stakeholder', at(2026)).invalid).toContain('ShareholderPercentage')
  })

  it('asks for the profile fields the embedded form requires', () => {
    const m = completeParty('guarantor')
    m.EI_PrimaryOccupation = ''
    const check = checkParty(m, 'guarantor', at(2026))
    expect(check.message).toBe(MSG_REQUIRED)
    expect(check.invalid).toContain('EI_PrimaryOccupation')
  })

  it('reports the FCS number, then the NIN, then the age, then the percentage', () => {
    const m = completeParty('stakeholder')
    m.ShareholderPercentage = '120'
    m.GSCAFB_YearOfBirth = '2020'
    m.II_CountryID = 'SHORT'
    m.II_FCSNumber = '12'
    expect(checkParty(m, 'stakeholder', at(2026))).toEqual({ invalid: ['II_FCSNumber'], message: MSG_FCS })
    m.II_FCSNumber = '1234567890123'
    expect(checkParty(m, 'stakeholder', at(2026))).toEqual({ invalid: ['II_CountryID'], message: MSG_NIN })
    m.II_CountryID = 'CM88000000ABCD'
    expect(checkParty(m, 'stakeholder', at(2026))).toEqual({
      invalid: ['GSCAFB_YearOfBirth'],
      message: MSG_AGE,
    })
    m.GSCAFB_YearOfBirth = '1988'
    expect(checkParty(m, 'stakeholder', at(2026))).toEqual({
      invalid: ['ShareholderPercentage'],
      message: MSG_PERCENTAGE,
    })
  })

  it('does not check the percentage of a guarantor', () => {
    const m = completeParty('guarantor')
    m.ShareholderPercentage = '500'
    expect(checkParty(m, 'guarantor', at(2026)).message).toBeNull()
  })

  it('still applies the company identity rule of the profile', () => {
    const m = completeParty('guarantor')
    Object.assign(m, {
      classificationCode: '1',
      GSCAFB_BusinessName: 'KTL',
      GSCAFB_TradingName: 'KTL',
      GSCAFB_ActivityDescription: 'x',
      GSCAFB_BusinessTypeCode: '3',
      GSCAFB_IndustrySectorCode: 'T',
      GSCAFB_DayRegistered: '1',
      GSCAFB_MonthRegistered: '2',
      GSCAFB_YearRegistered: '2010',
    })
    const check = checkParty(m, 'guarantor', at(2026))
    expect(check.message).toMatch(/Company Registration Certificate Number or Tax Identification Number/)
    m.II_RegistrationCertificateNumber = '800200'
    // a company is not held to the NIN or age rules
    expect(checkParty(m, 'guarantor', at(2026)).message).toBeNull()
  })
})
