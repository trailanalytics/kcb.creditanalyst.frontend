/** Where the UAT runs and which local users it signs in with. All values are local development ones (see .env.example). */
export const BASE_URL = process.env.UAT_BASE_URL ?? 'http://localhost:5242'
export const PASSWORD = process.env.UAT_USER_PASSWORD ?? 'Uat#Local2026'

/** The development administrator created by the compose stack (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). */
export const SUPER_ADMIN = {
  email: process.env.UAT_ADMIN_EMAIL ?? 'admin@kcb.test',
  password: process.env.UAT_ADMIN_PASSWORD ?? 'ChangeMe#2026',
}

/** The users created by scripts/uat/seed.sh in the backend repo (docs/uat/users.md describes what each can do). */
export const PERSONAS = {
  superadmin: SUPER_ADMIN.email,
  admin: 'uat.admin@kcb.test',
  officer: 'uat.officer@kcb.test',
  approver: 'uat.approver@kcb.test',
  checker: 'uat.checker@kcb.test',
  crb: 'uat.crb@kcb.test',
  readonly: 'uat.readonly@kcb.test',
  branch: 'uat.branch@kcb.test',
  noaccess: 'uat.noaccess@kcb.test',
  disabled: 'uat.disabled@kcb.test',
} as const

export type Persona = keyof typeof PERSONAS

export function passwordOf(persona: Persona): string {
  return persona === 'superadmin' ? SUPER_ADMIN.password : PASSWORD
}

/** Fixture customers loaded by scripts/uat/fixtures.sql (client numbers). */
export const CUSTOMER = {
  main: '9100001', // Okello James Peter, individual, branch 001
  profileEdit: '9100002', // Nakato Sarah Grace
  profileSpecial: '9100003', // Mugisha Robert
  company: '9100004', // Nile Traders Ltd
  jointPartner: '9100005', // Ssekandi David
  guarantor: '9100006', // Akello Mary
  securities: '9100007', // Byaruhanga Peter: has collateral, guarantor
  stakeholderPerson: '9100008', // Atim Grace
  nakawa: '9100009', // Wanyama Joseph, branch 002
  loans: '9100010', // Kiggundu Samuel: CBA loans
  writtenOff: '9100011', // Tumwebaze Annet
  loansCompany: '9100012', // Kamya and Sons Ltd
  foreign: '9100013', // Odhiambo Peter, Kenyan with a passport
  pis1: '9100014',
  pis2: '9100015',
  fraud: '9100016',
  bounced: '9100017',
  deletion: '9100018',
  spare: ['9100019', '9100020', '9100021', '9100022', '9100023', '9100024'],
} as const
