import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/dialogs', () => ({ swalNotification: vi.fn(), toast: {} }))
import { addressFrom, emptyAddress, missing, ADDRESS_REQUIRED } from '@/modules/institution/addressModel'
import { checkEmbedded } from '@/modules/institution/embeddedProfile'
import { escapeHtml } from '@/modules/institution/failure'
import { chequeRoutes } from '@/modules/cheque/routes'
import { fraudRoutes } from '@/modules/fraud/routes'
import { institutionRoutes } from '@/modules/institution/routes'
import { uploadMessage } from '@/modules/cheque/uploadMessage'
import { fraudBody, fraudFormFrom, newFraudForm } from '@/modules/fraud/fraudModel'
import type { FraudRecord } from '@/modules/fraud/types'
import { emptyProfile } from '@/modules/customer/profileModel'
import type { Customer } from '@/modules/customer/types'

const customer = {
  id: 5,
  clientNumber: '1000005',
  II_FCSNumber: null,
  full_name: 'Okello James ',
  customer_type: 'Individual',
  classificationCode: '0',
  currentAccount: null,
  branchCode: '001',
  individual_details: null,
  non_individual_details: null,
} as Customer

describe('route table', () => {
  const all = [...chequeRoutes, ...fraudRoutes, ...institutionRoutes]
  const permission = (path: string) => all.find((r) => r.path === path)?.meta?.permission

  it('keeps the Laravel paths, typo included, and their permissions', () => {
    expect(permission('/bc-list')).toBe('View Bounced Cheques')
    expect(permission('/upload-bounced-cheques')).toBe('Upload Bounced Cheques')
    expect(permission('/upload-fully-paid-or-write-offs')).toBe('Upload Bounced Cheques')
    expect(permission('/fraud')).toBe('Manage FRA')
    expect(permission('/institution')).toBe('Update PI Details')
    expect(permission('/pis')).toBe('Manage PIS')
    expect(permission('/proflie/new/pis')).toBe('Manage PIS')
    expect(permission('/pis/new')).toBe('Manage PIS')
    expect(permission('/edit/pis/:id(\\d+)')).toBe('Update PIS')
    expect(permission('/branches')).toBe('Manage Branches')
    expect(permission('/branches/new')).toBe('Create Branches')
    expect(permission('/branches/edit/:id(\\d+)')).toBe('Update Branches')
  })

  it('gives every route its own name', () => {
    const names = all.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('uploadMessage', () => {
  it('reports the count alone when everything matched', () => {
    expect(uploadMessage({ uploaded: 3, not_found: [], message: '' }, false)).toBe(
      '3 Bounced Cheques Uploaded Successfully',
    )
    expect(uploadMessage({ uploaded: 3, not_found: [], message: '' }, true)).toBe(
      '3 Fully Paid / Written Off Accounts Uploaded Successfully',
    )
  })

  it('lists what matched nothing, escaped because it comes from the file', () => {
    const html = uploadMessage({ uploaded: 1, not_found: ['A1', '<b>2'], message: '' }, false)
    expect(html).toContain('Accounts Numbers: A1,&lt;b&gt;2 could not find corresponding customers.')
    expect(html).not.toContain('<b>2')
    expect(uploadMessage({ uploaded: 0, not_found: ['C9'], message: '' }, true)).toContain(
      'Contract codes: C9 were not found among the loan accounts and were not updated.',
    )
  })

  it('escapes quotes and ampersands', () => expect(escapeHtml(`a&"<`)).toBe('a&amp;&quot;&lt;'))
})

describe('address helpers', () => {
  it('starts every phone on the Uganda code', () => {
    const a = emptyAddress()
    expect(a.PCI_PrimaryCountryDiallingCode).toBe('256')
    expect(Object.keys(a).every((k) => k.startsWith('PCI_'))).toBe(true)
  })

  it('fills the address and the moved-to selects from a saved record', () => {
    const form = { ...emptyAddress() }
    addressFrom(
      form,
      { PCI_District: 'Kampala', PCI_MobileCountryDiallingCode: null },
      { day: '', month: 5, year: 2012 },
    )
    expect(form.PCI_District).toBe('Kampala')
    expect(form.PCI_PeriodAtAddressMonth).toBe('5')
    expect(form.PCI_PeriodAtAddressYear).toBe('2012')
    expect(form.PCI_MobileCountryDiallingCode).toBe('256')
  })

  it('names the required fields still empty', () => {
    const form = emptyAddress()
    form.PCI_District = ' '
    expect(missing(form, ['PCI_District', 'PCI_Region'])).toEqual(['PCI_District', 'PCI_Region'])
    expect(missing({ ...form, PCI_District: 'x' }, ['PCI_District'])).toEqual([])
    expect(ADDRESS_REQUIRED).toContain('PCI_FlagofOwnership')
  })
})

describe('checkEmbedded', () => {
  it('asks for the surrounding form first, then the profile', () => {
    const form = emptyProfile('0')
    const first = checkEmbedded(form, ['ShareholderPercentage'])
    expect(first.message).toBe('Kindly check inputs with a red border and fill in appropriately!')
    expect(first.invalid).toEqual(
      expect.arrayContaining(['ShareholderPercentage', 'branchCode', 'GSCAFB_Surname']),
    )
  })

  it('does not ask a profile embedded in a form for its own branch row twice', () => {
    const form = { ...emptyProfile('0'), branchCode: '001' }
    expect(checkEmbedded(form, []).invalid).not.toContain('branchCode')
  })
})

describe('fraud form', () => {
  it('opens a new incident in shillings with zero amounts and the chosen profile', () => {
    const form = newFraudForm(customer)
    expect(form.profile).toMatchObject({
      profile_id: '5',
      currency: 'UGX',
      classificationCode: '0',
      branchCode: '001',
      fraudCategory: '',
    })
    expect(form.savings).toBe(0)
    expect(form.loss).toBe(0)
  })

  it('prefills an edit from the record and posts amounts as numbers', () => {
    const record: FraudRecord = {
      id: 11,
      clientNumber: '1000005',
      fraudCategory: '7',
      IncidentDate: '20240315',
      SavingsAmount: '5000000',
      LossAmount: null,
      currency: 'USD',
      IncidentDetails: 'Forged cheque',
      forensicInformationAvailable: 'A',
      category_name: 'Forgery',
      incident_date_variable: { day: 15, month: 3, year: 2024 },
      customer,
    }
    const form = fraudFormFrom(record)
    expect(form.profile).toMatchObject({
      fraudCategory: '7',
      incident_day: '15',
      incident_month: '3',
      incident_year: '2024',
      currency: 'USD',
      forensicInformation: 'A',
    })
    expect(fraudBody(form)).toMatchObject({ saving_amount: 5000000, loss_amount: 0, profile_id: '5' })
    expect(fraudBody({ ...form, savings: null }).saving_amount).toBe(0)
  })
})
