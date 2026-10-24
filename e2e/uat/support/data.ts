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
  const r = await api.must(
    api.post('/api/v1/applications', {
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
 * The next unused loan of the pool UATAP0001..UATAP0120 loaded by the seed. A loan can approve only one application, so each
 * approval case takes the next one. The count is kept in e2e/uat/.auth/pool.json and starts again when the seed is run again
 * (the pool loans get new ids then).
 */
export async function nextPoolLoan(api: Api): Promise<string> {
  const found = await api.get('/api/v1/loans', { search: 'UATAP0001' })
  const first = (found.body?.data ?? []).find((l: any) => l.contractCode === 'UATAP0001')
  if (!first) throw new Error('The loan pool UATAP0001.. is missing: run scripts/uat/seed.sh')
  let state = { generation: first.id as number, next: 1 }
  if (existsSync(POOL_FILE)) {
    const saved = JSON.parse(readFileSync(POOL_FILE, 'utf8'))
    if (saved.generation === first.id) state = saved
  }
  if (state.next > 120) throw new Error('The 120 pool loans are used up: run scripts/uat/seed.sh again')
  const code = `UATAP${String(state.next).padStart(4, '0')}`
  state.next += 1
  mkdirSync(dirname(POOL_FILE), { recursive: true })
  writeFileSync(POOL_FILE, JSON.stringify(state))
  return code
}
