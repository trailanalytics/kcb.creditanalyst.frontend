import { describe, expect, it } from 'vitest'
import {
  checkCollateral,
  collateralFrom,
  collateralPayload,
  contextFields,
  contextReference,
  emptyCollateral,
  MSG_FORCED_SALE,
  MSG_OPEN_MARKET,
} from '@/modules/securities/collateralModel'
import { crbToIso } from '@/modules/securities/dates'
import {
  editPartyForm,
  existingPartyForm,
  newPartyForm,
  partyPayload,
  partyTitle,
  switchClassification,
} from '@/modules/securities/partyModel'
import type { CollateralRow, GuarantorRow, StakeholderRow } from '@/modules/securities/types'
import type { Customer } from '@/modules/customer/types'

const customer = {
  id: 42,
  clientNumber: 'SGBG71001',
  II_FCSNumber: '1234567890123',
  full_name: 'Okello James  ',
  customer_type: 'Individual',
  classificationCode: '0',
  currentAccount: null,
  branchCode: '001',
  individual_details: {
    id: 1,
    GSCAFB_Surname: 'Okello',
    GSCAFB_Forename1: 'James',
    II_CountryID: 'CM88000000ABCD',
    dob_variable: { day: 4, month: 7, year: 1988 },
    joined_employer_variable: { day: '', month: '', year: '' },
  },
  non_individual_details: null,
} as unknown as Customer

describe('collateral form', () => {
  const row = {
    id: 1,
    CollateralType: '3',
    CollateralCurrency: 'UGX',
    CollateralForcedSaleValue: '4000000',
    CollateralOpenMarketValue: '5000000',
    ValuationDate: '20261001',
    CollateralExpiryDate: '20271231',
    InstrumentofClaim: 'Land Title',
    CollateralDescription: 'Plot 12',
  } as CollateralRow

  it('loads an existing collateral with numbers and input dates', () => {
    expect(collateralFrom(row)).toEqual({
      CollateralType: '3',
      CollateralCurrency: 'UGX',
      CollateralForcedSaleValue: 4000000,
      CollateralOpenMarketValue: 5000000,
      valuationDate: '2026-10-01',
      expiryDate: '2027-12-31',
      InstrumentofClaim: 'Land Title',
      CollateralDescription: 'Plot 12',
    })
  })

  it('asks for the forced sale value first, then the open market value', () => {
    const f = emptyCollateral()
    expect(checkCollateral(f)).toBe(MSG_FORCED_SALE)
    f.CollateralForcedSaleValue = 1
    expect(checkCollateral(f)).toBe(MSG_OPEN_MARKET)
    f.CollateralOpenMarketValue = 0
    expect(checkCollateral(f)).toBe(MSG_OPEN_MARKET)
    f.CollateralOpenMarketValue = 2
    expect(checkCollateral(f)).toBeNull()
  })

  it('posts the amounts as plain digit strings and names the application or the loan', () => {
    const f = collateralFrom(row)
    const onCap = collateralPayload(f, { type: 'application', referenceNumber: 'KCB/CAP/202610/000001' })
    expect(onCap).toMatchObject({
      referenceNumber: 'KCB/CAP/202610/000001',
      CollateralForcedSaleValue: '4000000',
      CollateralOpenMarketValue: '5000000',
      valuationDate: '2026-10-01',
    })
    expect(onCap).not.toHaveProperty('contractCode')
    const onLoan = collateralPayload(f, { type: 'loan', contractCode: 'AA1' })
    expect(onLoan).toMatchObject({ contractCode: 'AA1' })
    expect(onLoan).not.toHaveProperty('referenceNumber')
    expect(collateralPayload(f)).not.toHaveProperty('referenceNumber')
  })

  it('gives the reference of either kind of context', () => {
    expect(contextReference({ type: 'application', referenceNumber: 'K1' })).toBe('K1')
    expect(contextReference({ type: 'loan', contractCode: 'AA1' })).toBe('AA1')
    expect(contextFields(undefined)).toEqual({})
  })

  it('turns CRB dates into input dates and ignores anything else', () => {
    expect(crbToIso('20261001')).toBe('2026-10-01')
    expect(crbToIso('2026-10-01')).toBe('')
    expect(crbToIso(null)).toBe('')
  })
})

describe('guarantor and stakeholder forms', () => {
  it('starts a new party empty with the modal fields present', () => {
    const g = newPartyForm('guarantor', '1')
    expect(g.classificationCode).toBe('1')
    expect(g).toMatchObject({ ValueOfGuarantorsCollateral: '', GuaranteeType: '', GuarantorType: '' })
    expect(newPartyForm('stakeholder', '0')).toMatchObject({
      ShareholderPercentage: '',
      StakeholderCategory: '',
    })
  })

  it('fills the form from an existing customer and keeps its id as profile_id', () => {
    const m = existingPartyForm('guarantor', customer)
    expect(m).toMatchObject({
      clientNumber: 'SGBG71001',
      GSCAFB_Surname: 'Okello',
      profile_id: '42',
      branchCode: '001',
      GSCAFB_YearOfBirth: '1988',
    })
  })

  it('fills the form from a guarantor row, with its guarantee values', () => {
    const row = {
      id: 7,
      guarantor_profile: customer,
      valueOfGuarantorCollateral: '2500',
      guarateeType: '1',
      guarantorType: '0',
    } as GuarantorRow
    expect(editPartyForm('guarantor', row)).toMatchObject({
      ValueOfGuarantorsCollateral: '2500',
      GuaranteeType: '1',
      GuarantorType: '0',
      GSCAFB_Forename1: 'James',
    })
  })

  it('fills the form from a stakeholder row and titles it Update once a shareholding is set', () => {
    const row = {
      id: 8,
      stakeholder_profile: customer,
      ShareholderPercentage: '40',
      StakeholderCategory: '2',
    } as StakeholderRow
    const m = editPartyForm('stakeholder', row)
    expect(m).toMatchObject({ ShareholderPercentage: '40', StakeholderCategory: '2' })
    expect(partyTitle('stakeholder', m)).toBe('Update Stakeholder')
    expect(partyTitle('stakeholder', newPartyForm('stakeholder', '0'))).toBe('Add Stakeholder')
    expect(partyTitle('guarantor', m)).toBe('Add Guarantor')
  })

  it('keeps the modal fields when the classification of a new party is switched', () => {
    const m = newPartyForm('guarantor', '0')
    m.branchCode = '005'
    m.ValueOfGuarantorsCollateral = '100'
    m.GSCAFB_Surname = 'Typed'
    const next = switchClassification('guarantor', m, '1')
    expect(next).toMatchObject({
      classificationCode: '1',
      branchCode: '005',
      ValueOfGuarantorsCollateral: '100',
      GSCAFB_Surname: '',
    })
  })

  it('posts the profile as it is with the context, and without the client numbers', () => {
    const m = existingPartyForm('guarantor', customer)
    m.GuarantorClientNumber = 'SGBG71001'
    const body = partyPayload(m, { type: 'loan', contractCode: 'AA1' })
    expect(body).toMatchObject({ contractCode: 'AA1', profile_id: '42', GSCAFB_Surname: 'Okello' })
    expect(body).not.toHaveProperty('clientNumber')
    expect(body).not.toHaveProperty('GuarantorClientNumber')
    // a new customer has no profile_id at all
    expect(partyPayload(newPartyForm('guarantor', '0'))).not.toHaveProperty('profile_id')
  })
})
