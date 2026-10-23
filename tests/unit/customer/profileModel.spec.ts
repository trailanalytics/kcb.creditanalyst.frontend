import { describe, expect, it } from 'vitest'
import { emptyProfile, profileFrom } from '@/modules/customer/profileModel'
import type { Customer } from '@/modules/customer/types'

const parts = (day: number | '', month: number | '', year: number | '') => ({ day, month, year })

function individual(extra: Record<string, unknown> = {}): Customer {
  return {
    id: 7,
    clientNumber: '1000001',
    II_FCSNumber: 'FCS1',
    full_name: 'Okello James',
    customer_type: 'Individual',
    classificationCode: '0',
    currentAccount: null,
    branchCode: '001',
    II_Nationality: 'UG',
    PCI_PrimaryCountryDiallingCode: null,
    PCI_MobileNumber: '0772',
    PCI_MovedTOAddressOn: '20150301',
    SCI_MovedTOAddressOn: null,
    individual_details: {
      id: 1,
      GSCAFB_Surname: 'Okello',
      GSCAFB_Forename1: 'James',
      II_CountryID: 'CM88',
      dob_variable: parts(4, 7, 1988),
      joined_employer_variable: parts('', '', ''),
    },
    non_individual_details: null,
    ...extra,
  }
}

describe('profile form model', () => {
  it('starts blank with Uganda preselected on every phone', () => {
    const m = emptyProfile('1')
    expect(m.classificationCode).toBe('1')
    expect(m.PCI_PrimaryCountryDiallingCode).toBe('256')
    expect(m.SCI_OtherCountryDiallingCode).toBe('256')
    expect(m.GSCAFB_Surname).toBe('')
  })

  it('fills the form from a customer, splitting the stored dates into the select parts', () => {
    const m = profileFrom(individual())
    expect(m.clientNumber).toBe('1000001')
    expect(m.GSCAFB_Surname).toBe('Okello')
    expect([m.GSCAFB_DayOfBirth, m.GSCAFB_MonthOfBirth, m.GSCAFB_YearOfBirth]).toEqual(['4', '7', '1988'])
    expect([m.joinedEmployerMonth, m.joinedEmployerYear]).toEqual(['', ''])
    expect([m.PCI_PeriodAtAddressMonth, m.PCI_PeriodAtAddressYear]).toEqual(['3', '2015'])
    expect([m.SCI_PeriodAtAddressMonth, m.SCI_PeriodAtAddressYear]).toEqual(['', ''])
  })

  it('shows Uganda for a phone saved without a dialling code, and reads each phone from its own field', () => {
    const m = profileFrom(individual())
    expect(m.PCI_PrimaryCountryDiallingCode).toBe('256')
    expect(m.PCI_MobileNumber).toBe('0772')
    expect(m.PCI_PrimaryTelephoneNumber).toBe('')
  })

  it('reads a company from its own details', () => {
    const m = profileFrom(
      individual({
        classificationCode: '1',
        individual_details: null,
        non_individual_details: { id: 2, GSCAFB_BusinessName: 'KTL', reg_variable: parts(1, 2, 2010) },
      }),
    )
    expect(m.classificationCode).toBe('1')
    expect(m.GSCAFB_BusinessName).toBe('KTL')
    expect([m.GSCAFB_DayRegistered, m.GSCAFB_MonthRegistered, m.GSCAFB_YearRegistered]).toEqual([
      '1',
      '2',
      '2010',
    ])
  })
})
