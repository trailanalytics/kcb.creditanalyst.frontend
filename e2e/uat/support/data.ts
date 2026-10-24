import type { Api } from './api'
import { today, uniqueAmount } from './ui'

/** The id of the fixture customer with this client number (ids change every time the seed is run). */
export async function profileId(api: Api, clientNumber: string): Promise<number> {
  const r = await api.get('/api/v1/profiles', { search: clientNumber, page: 1 })
  const row = (r.body?.data ?? []).find((c: any) => c.clientNumber === clientNumber)
  if (!row) throw new Error(`customer ${clientNumber} not found: run scripts/uat/seed.sh (HTTP ${r.status})`)
  return row.id
}

export async function profile(api: Api, clientNumber: string): Promise<any> {
  const id = await profileId(api, clientNumber)
  return (await api.must(api.get(`/api/v1/profiles/${id}`), 'read profile')).body
}

export interface NewApplication {
  clientNumber: string
  amount?: string
  currency?: string
  product?: string
  purpose?: string
  branch?: string
  term?: string
  termPeriod?: 'Month' | 'Year'
  date?: string
}

/** A pending credit application created through the API (what the New CAP form posts). Returns the saved application. */
export async function createApplication(api: Api, a: NewApplication): Promise<any> {
  // the form posts the borrower's profile fields with the loan; a company needs its trading name and registration date
  const customer = await profile(api, a.clientNumber)
  const company =
    customer.classificationCode === '1'
      ? {
          classificationCode: '1',
          GSCAFB_TradingName: customer.non_individual_details.GSCAFB_TradingName,
          GSCAFB_DayRegistered: String(customer.non_individual_details.reg_variable.day),
          GSCAFB_MonthRegistered: String(customer.non_individual_details.reg_variable.month),
          GSCAFB_YearRegistered: String(customer.non_individual_details.reg_variable.year),
        }
      : {}
  const r = await api.must(
    api.post('/api/v1/applications', {
      ...company,
      clientNumber: a.clientNumber,
      creditApplicationDate: a.date ?? today(),
      amount: a.amount ?? uniqueAmount(),
      currency: a.currency ?? 'UGX',
      CreditAccountLoanProductType: a.product ?? '2',
      loanPurpose: a.purpose ?? '1',
      branch: a.branch ?? '001',
      Term: a.term ?? '12',
      Term_Period: a.termPeriod ?? 'Month',
    }),
    'create application',
  )
  return r.body
}

export async function application(api: Api, id: number): Promise<any> {
  return (await api.must(api.get(`/api/v1/applications/${id}`), 'read application')).body
}

/** Format a whole amount the way the lists show it (thousands separators). */
export function money(n: number | string): string {
  return Number(n).toLocaleString('en-US')
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { authFile } from './auth'

const POOL_FILE = authFile('officer').replace('officer.json', 'pool.json')

/**
 * The next unused record of a pool the seed loads (loans UATAP0001..UATAP0120 for approvals, UATWO0001..0040 for write-offs,
 * UATFC0001..0030 for force closing, off balance items UATOBX0001..0040): a loan can be approved against, written off or force
 * closed only once, so each case takes the next one. The counters are kept in e2e/uat/.auth/pool.json and start again when the seed
 * is run again (the pool rows get new ids then).
 */
export async function nextFromPool(
  api: Api,
  prefix: 'UATAP' | 'UATWO' | 'UATFC' | 'UATFP' | 'UATOBX',
  size: number,
): Promise<{ code: string; id: number }> {
  const probe = `${prefix}0001`
  const path = prefix === 'UATOBX' ? '/api/v1/off-balance-sheet-items' : '/api/v1/loans'
  const found = await api.get(path, { search: probe })
  const first = (found.body?.data ?? []).find((l: any) => l.contractCode === probe)
  if (!first) throw new Error(`The pool ${probe}.. is missing: run scripts/uat/seed.sh`)
  const all: Record<string, { generation: number; next: number }> = existsSync(POOL_FILE)
    ? JSON.parse(readFileSync(POOL_FILE, 'utf8'))
    : {}
  let state = all[prefix]
  if (!state || state.generation !== first.id) state = { generation: first.id as number, next: 1 }
  if (state.next > size)
    throw new Error(`The ${size} ${prefix} records are used up: run scripts/uat/seed.sh again`)
  const code = `${prefix}${String(state.next).padStart(4, '0')}`
  state.next += 1
  all[prefix] = state
  mkdirSync(dirname(POOL_FILE), { recursive: true })
  writeFileSync(POOL_FILE, JSON.stringify(all))
  const row =
    code === probe
      ? first
      : ((await api.get(path, { search: code })).body.data as any[]).find((l) => l.contractCode === code)
  return { code, id: row.id }
}

export async function nextPoolLoan(api: Api): Promise<string> {
  return (await nextFromPool(api, 'UATAP', 120)).code
}

/** A collateral for the borrower of a pending application, created through the API (and attached to the application). */
export async function createCollateral(
  api: Api,
  applicationReference: string,
  description = `UAT collateral ${Date.now()}`,
): Promise<any> {
  const r = await api.must(
    api.post('/api/v1/collaterals', {
      referenceNumber: applicationReference,
      CollateralType: '1',
      CollateralCurrency: 'UGX',
      CollateralForcedSaleValue: '4000000',
      CollateralOpenMarketValue: '5000000',
      valuationDate: '2026-10-01',
      expiryDate: '2030-12-31',
      InstrumentofClaim: 'Land Title',
      CollateralDescription: description,
    }),
    'create collateral',
  )
  return r.body
}

let nameSeq = 0
/** A name that is unique in the database and still a plain surname (letters only). */
export function uniqueName(prefix: string): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  let n = Date.now() * 100 + (nameSeq += 1)
  let out = ''
  while (n > 0) {
    out += letters[n % 26]
    n = Math.floor(n / 26)
  }
  return `${prefix}${out}`
}

function personBody(applicationReference: string, surname: string, fcs: string, nin: string) {
  return {
    referenceNumber: applicationReference,
    classificationCode: '0',
    branchCode: '001',
    GSCAFB_Surname: surname,
    GSCAFB_Forename1: 'Uat',
    II_FCSNumber: fcs,
    II_CountryOfIssue: 'UG',
    II_CountryID: nin,
    PCI_PrimaryTelephoneNumber: '0700000000',
  }
}

/** A new individual guarantor of the borrower of a pending application, through the API. */
export async function createGuarantor(
  api: Api,
  applicationReference: string,
  surname = uniqueName('Uatg'),
): Promise<any> {
  const stamp = String(Date.now()).slice(-9)
  const r = await api.must(
    api.post('/api/v1/guarantors', {
      ...personBody(applicationReference, surname, `FCSG${stamp}`, `CMG${stamp}UAT`),
      ValueOfGuarantorsCollateral: '7500000',
      GuaranteeType: '1',
      GuarantorType: '0',
    }),
    'create guarantor',
  )
  return r.body
}

/** A new individual stakeholder of the (company) borrower of a pending application, through the API. */
export async function createStakeholder(
  api: Api,
  applicationReference: string,
  surname = uniqueName('Uats'),
): Promise<any> {
  const stamp = String(Date.now()).slice(-9)
  const r = await api.must(
    api.post('/api/v1/stakeholders', {
      ...personBody(applicationReference, surname, `FCSS${stamp}`, `CMS${stamp}UAT`),
      ShareholderPercentage: '10',
      StakeholderCategory: '1',
    }),
    'create stakeholder',
  )
  return r.body
}

export async function securities(api: Api, reference: string): Promise<any> {
  return (await api.must(api.get('/api/v1/securities', { referenceNumber: reference }), 'read securities'))
    .body
}
