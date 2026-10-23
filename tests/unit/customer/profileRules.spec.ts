import { describe, expect, it } from 'vitest'
import { emptyProfile } from '@/modules/customer/profileModel'
import {
  checkProfile,
  MSG_COMPANY_ID,
  MSG_FOREIGN_ID,
  MSG_REQUIRED,
  requiredFields,
} from '@/modules/customer/profileRules'
import type { ProfileModel } from '@/modules/customer/types'

/** An individual with everything the form requires. */
function completeIndividual(): ProfileModel {
  const m = emptyProfile('0')
  Object.assign(m, {
    branchCode: '001',
    GSCAFB_MaritalStatus: 'S',
    GSCAFB_DayOfBirth: '4',
    GSCAFB_MonthOfBirth: '7',
    GSCAFB_YearOfBirth: '1988',
    II_Nationality: 'UG',
    II_CountryOfIssue: 'UG',
    II_CountryID: 'CM88000000ABCD',
    EI_EmploymentType: '1',
    EI_EmployerName: 'KCB',
    EI_IncomeBand: '2',
    EI_SalaryFrequency: 'M',
  })
  for (const p of ['PCI_', 'SCI_'])
    Object.assign(m, {
      [`${p}CountryCode`]: 'UG',
      [`${p}Region`]: 'C',
      [`${p}District`]: 'Kampala',
      [`${p}CountyorTown`]: 'Kampala',
      [`${p}Suburb`]: 'Nakawa',
      [`${p}Parish`]: 'Butabika',
      [`${p}Village`]: 'Banda',
      [`${p}PrimaryAreaDiallingCode`]: '78',
      [`${p}PrimaryTelephoneNumber`]: '6409927',
      [`${p}MobileAreaDiallingCode`]: '78',
      [`${p}MobileNumber`]: '6409928',
      [`${p}FlagofOwnership`]: 'O',
    })
  return m
}

function completeCompany(): ProfileModel {
  const m = completeIndividual()
  Object.assign(m, {
    classificationCode: '1',
    GSCAFB_BusinessName: 'KTL',
    GSCAFB_TradingName: 'KTL',
    GSCAFB_ActivityDescription: 'Trading',
    GSCAFB_BusinessTypeCode: '3',
    GSCAFB_IndustrySectorCode: 'T',
    GSCAFB_DayRegistered: '1',
    GSCAFB_MonthRegistered: '2',
    GSCAFB_YearRegistered: '2010',
    II_RegistrationCertificateNumber: '800200',
  })
  return m
}

describe('profile validation', () => {
  it('passes a complete individual', () => {
    expect(checkProfile(completeIndividual())).toEqual({ invalid: [], message: null })
  })

  it('lists the empty required fields and asks the user to check the red borders', () => {
    const m = completeIndividual()
    m.GSCAFB_MaritalStatus = ''
    m.PCI_Village = '  '
    const check = checkProfile(m)
    expect(check.message).toBe(MSG_REQUIRED)
    expect(check.invalid).toEqual(['GSCAFB_MaritalStatus', 'PCI_Village'])
  })

  it('needs the national ID only for a Ugandan identity document', () => {
    const m = completeIndividual()
    m.II_CountryID = ''
    expect(checkProfile(m).invalid).toEqual(['II_CountryID'])
    m.II_CountryOfIssue = 'KE'
    expect(requiredFields(m)).not.toContain('II_CountryID')
    expect(checkProfile(m)).toEqual({
      invalid: ['II_PassportNumber', 'II_RefugeeNumber'],
      message: MSG_FOREIGN_ID,
    })
    m.II_PassportNumber = 'B123'
    expect(checkProfile(m).message).toBeNull()
  })

  it('needs a registration number or a TIN for a company', () => {
    const m = completeCompany()
    expect(checkProfile(m).message).toBeNull()
    m.II_RegistrationCertificateNumber = ''
    expect(checkProfile(m)).toEqual({
      invalid: ['II_RegistrationCertificateNumber', 'II_TaxIdentificationNumber'],
      message: MSG_COMPANY_ID,
    })
    m.II_TaxIdentificationNumber = '1000'
    expect(checkProfile(m).message).toBeNull()
  })

  it('does not ask a company for individual fields, nor an individual for company fields', () => {
    expect(requiredFields(completeCompany())).not.toContain('GSCAFB_MaritalStatus')
    expect(requiredFields(completeIndividual())).not.toContain('GSCAFB_BusinessName')
  })

  it('relaxes the primary county and the alternative district on the joint form', () => {
    const joint = requiredFields(completeIndividual(), { joint: true })
    expect(joint).not.toContain('PCI_CountyorTown')
    expect(joint).not.toContain('SCI_District')
    expect(joint).toContain('SCI_CountyorTown')
    expect(joint).toContain('PCI_District')
  })
})
