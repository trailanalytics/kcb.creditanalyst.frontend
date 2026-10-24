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

interface PoolSpec {
  size: number
  path: string
  key: string
  name: (n: number) => string
}

const POOLS: Record<string, PoolSpec> = {
  UATAP: {
    size: 120,
    path: '/api/v1/loans',
    key: 'contractCode',
    name: (n) => `UATAP${String(n).padStart(4, '0')}`,
  },
  UATWO: {
    size: 40,
    path: '/api/v1/loans',
    key: 'contractCode',
    name: (n) => `UATWO${String(n).padStart(4, '0')}`,
  },
  UATFC: {
    size: 30,
    path: '/api/v1/loans',
    key: 'contractCode',
    name: (n) => `UATFC${String(n).padStart(4, '0')}`,
  },
  UATFP: {
    size: 30,
    path: '/api/v1/loans',
    key: 'contractCode',
    name: (n) => `UATFP${String(n).padStart(4, '0')}`,
  },
  UATOBX: {
    size: 40,
    path: '/api/v1/off-balance-sheet-items',
    key: 'contractCode',
    name: (n) => `UATOBX${String(n).padStart(4, '0')}`,
  },
  CUSTDEL: {
    size: 30,
    path: '/api/v1/profiles',
    key: 'clientNumber',
    name: (n) => `91001${String(n).padStart(2, '0')}`,
  },
}

/**
 * The next unused record of a pool the seed loads (loans UATAP0001..UATAP0120 for approvals, UATWO0001..0040 for write-offs,
 * UATFC0001..0030 for force closing, UATFP0001..0030 for the fully paid upload, off balance items UATOBX0001..0040, customers
 * 9100101..9100130 for profile deletion): a loan can be approved against, written off or force closed only once, so each case takes
 * the next one. The counters are kept in e2e/uat/.auth/pool.json and start again when the seed is run again (the pool rows get new
 * ids then). `code` is the contract code or the client number.
 */
export async function nextFromPool(
  api: Api,
  prefix: keyof typeof POOLS | string,
  size?: number,
): Promise<{ code: string; id: number }> {
  const spec = POOLS[prefix]
  const limit = size ?? spec.size
  // the generation is the id of the LAST row of the pool: the first rows are the ones that get used (and an off balance item
  // that got its client number or was deleted no longer shows in the list), the last one stays until the pool is used up
  const probe = spec.name(limit)
  const found = await api.get(spec.path, { search: probe })
  const last = (found.body?.data ?? []).find((l: any) => l[spec.key] === probe)
  if (!last) throw new Error(`The pool ${probe} is missing: run scripts/uat/seed.sh`)
  const all: Record<string, { generation: number; next: number }> = existsSync(POOL_FILE)
    ? JSON.parse(readFileSync(POOL_FILE, 'utf8'))
    : {}
  let state = all[prefix]
  if (!state || state.generation !== last.id) state = { generation: last.id as number, next: 1 }
  if (state.next > limit)
    throw new Error(`The ${limit} ${prefix} records are used up: run scripts/uat/seed.sh again`)
  const code = spec.name(state.next)
  state.next += 1
  all[prefix] = state
  mkdirSync(dirname(POOL_FILE), { recursive: true })
  writeFileSync(POOL_FILE, JSON.stringify(all))
  const row =
    code === probe
      ? last
      : ((await api.get(spec.path, { search: code })).body.data as any[]).find((l) => l[spec.key] === code)
  if (!row) throw new Error(`${code} of the ${prefix} pool is not in the list: run scripts/uat/seed.sh again`)
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

/** A branch created through the API (needs Update Branches); the code is unique enough for a run. */
export async function createBranch(api: Api, prefix = 'D'): Promise<any> {
  const code = `${prefix}${Date.now().toString().slice(-6)}`
  const r = await api.must(
    api.post('/api/v1/bank-branches', {
      BranchName: `UAT ${prefix} ${code}`,
      bankBranchCode: code,
      BranchIdentificationCode: code,
      BranchType: '1',
      openDay: '1',
      openMonth: '1',
      openYear: '2020',
      PCI_CountryCode: 'UG',
      PCI_Region: 'C',
      PCI_District: 'Kampala',
      PCI_CountyorTown: 'Kampala',
      PCI_Suburb: 'Nakawa',
      PCI_Parish: 'Butabika',
      PCI_Village: 'Banda',
      PCI_PrimaryCountryDiallingCode: '256',
      PCI_PrimaryAreaDiallingCode: '41',
      PCI_PrimaryTelephoneNumber: '6409927',
      PCI_MobileCountryDiallingCode: '256',
      PCI_MobileAreaDiallingCode: '78',
      PCI_MobileNumber: '6409928',
      PCI_OtherCountryDiallingCode: '256',
      PCI_FlagofOwnership: 'O',
    }),
    'create branch',
  )
  return r.body
}
