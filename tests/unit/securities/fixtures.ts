import type { ProfileModel } from '@/modules/customer/types'
import { newPartyForm } from '@/modules/securities/partyModel'
import type { PartyKind } from '@/modules/securities/types'

/** A guarantor or stakeholder form that passes every check: an individual with a Ugandan NIN and the modal's own fields. */
export function completeParty(kind: PartyKind = 'guarantor'): ProfileModel {
  const m = newPartyForm(kind, '0')
  Object.assign(m, {
    branchCode: '001',
    GSCAFB_Surname: 'Okello',
    GSCAFB_Forename1: 'James',
    GSCAFB_MaritalStatus: 'S',
    GSCAFB_DayOfBirth: '4',
    GSCAFB_MonthOfBirth: '7',
    GSCAFB_YearOfBirth: '1988',
    II_FCSNumber: '1234567890123',
    II_Nationality: 'UG',
    II_CountryOfIssue: 'UG',
    II_CountryID: 'CM88000000ABCD',
    EI_EmploymentType: '1',
    EI_PrimaryOccupation: 'Teacher',
    EI_EmployerName: 'KCB',
    EI_IncomeBand: '2',
    EI_SalaryFrequency: 'M',
    joinedEmployerMonth: '3',
    joinedEmployerYear: '2012',
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
  if (kind === 'guarantor')
    Object.assign(m, { ValueOfGuarantorsCollateral: '5000000', GuaranteeType: '0', GuarantorType: '0' })
  else Object.assign(m, { ShareholderPercentage: '40', StakeholderCategory: '1' })
  return m
}

/** A customer (API shape) whose profile form is the complete one above. */
export function completeCustomer(kind: PartyKind = 'guarantor', id = 7): Record<string, unknown> {
  const m = completeParty(kind)
  return {
    ...m,
    id,
    clientNumber: 'SGBG71007',
    full_name: 'Okello James  ',
    customer_type: 'Individual',
    classificationCode: '0',
    individual_details: {
      ...m,
      id: 1,
      dob_variable: { day: 4, month: 7, year: 1988 },
      joined_employer_variable: { day: 1, month: 3, year: 2012 },
    },
    non_individual_details: null,
  }
}
