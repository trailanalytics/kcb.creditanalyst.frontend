import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'

vi.mock('@/api/http', () => ({
  http: { get: vi.fn() },
  messageOf: (e: { message?: string }, fallback: string) => e?.message ?? fallback,
  problemOf: () => null,
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalOk: { fire: vi.fn() },
  swalDelete: { fire: vi.fn() },
  swalConfirm: { fire: vi.fn() },
  toast: {},
}))
vi.mock('@/modules/requests/useDeletionRequest', () => ({
  submitDeletionRequest: vi.fn(),
  promptReason: vi.fn(),
}))
vi.mock('@/modules/customer/profileDeletion', () => ({ requestProfileDeletion: vi.fn() }))

import { http } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import { promptReason, submitDeletionRequest } from '@/modules/requests/useDeletionRequest'
import { requestProfileDeletion } from '@/modules/customer/profileDeletion'
import { useAuthStore } from '@/stores/auth'
import ApplicationsPage from '@/modules/application/ApplicationsPage.vue'
import BsListPage from '@/modules/securities/BsListPage.vue'
import CcgListPage from '@/modules/securities/CcgListPage.vue'
import CmcListPage from '@/modules/securities/CmcListPage.vue'
import BranchesPage from '@/modules/institution/BranchesPage.vue'
import PisPage from '@/modules/institution/PisPage.vue'
import UsersPage from '@/modules/identity/UsersPage.vue'
import ProfilesPage from '@/modules/customer/ProfilesPage.vue'

const FLAG =
  '[title="This record has been requested to be deleted!"], [title="This user has been requested to be deleted!"]'
const customer = {
  id: 1,
  full_name: 'Okello James ',
  customer_type: 'Individual',
  clientNumber: '1000001',
  classificationCode: '0',
  individual_details: null,
  non_individual_details: null,
}

interface Case {
  name: string
  component: Component
  permission: string
  table: string
  text: string
  placeholder: string
  required: string
  /** Opens the delete control of the first row. */
  trigger: (w: ReturnType<typeof mount>) => Promise<void>
  row: (extra?: Record<string, unknown>) => Record<string, unknown>
  deleted: Record<string, unknown>
  /** The label the visible delete button carries. */
  button?: RegExp
}

const clickButton = (label: RegExp) => async (w: ReturnType<typeof mount>) => {
  const b = w.findAll('button').find((x) => label.test(x.attributes('aria-label') ?? ''))
  if (!b) throw new Error(`no button ${label}`)
  await b.trigger('click')
}

const cases: Case[] = [
  {
    name: 'CMC list',
    component: CmcListPage,
    permission: 'Delete Collateral',
    table: 'collaterals',
    text: 'You are about to submit a request to delete this Collateral! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    required: 'The reason for your request to delete this record is required!',
    trigger: clickButton(/^Request deletion of /),
    row: (extra = {}) => ({
      id: 11,
      CollateralType: 'Land',
      cmc_type: 'Land title',
      CollateralReferenceNumber: 'COL-11',
      CollateralCurrency: 'UGX',
      CollateralOpenMarketValue: '1000',
      InstrumentofClaim: 'Mortgage',
      is_deleted: false,
      customer,
      ...extra,
    }),
    deleted: { is_deleted: true },
  },
  {
    name: 'CCG list',
    component: CcgListPage,
    permission: 'Delete Guarantors',
    table: 'borrower_guarantors',
    text: 'You are about to submit a request to delete this Guarantor! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    required: 'The reason for your request to delete this record is required!',
    trigger: clickButton(/^Request deletion of guarantor/),
    row: (extra = {}) => ({
      id: 12,
      GuarantorClientNumber: '2000002',
      valueOfGuarantorCollateral: '500',
      is_deleted: false,
      guarantor_profile: customer,
      borrower: customer,
      ...extra,
    }),
    deleted: { is_deleted: true },
  },
  {
    name: 'BS list',
    component: BsListPage,
    permission: 'Delete Stakeholder',
    table: 'borrower_stakeholders',
    text: 'You are about to submit a request to delete this Stakeholder! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    required: 'The reason for your request to delete this record is required!',
    trigger: clickButton(/^Request deletion of stakeholder/),
    row: (extra = {}) => ({
      id: 13,
      StakeholderClientNumber: '3000003',
      ShareholderPercentage: '40',
      category_name: 'Director',
      is_deleted: false,
      stakeholder_profile: customer,
      borrower: customer,
      ...extra,
    }),
    deleted: { is_deleted: true },
  },
  {
    name: 'PIS list',
    component: PisPage,
    permission: 'Delete PIS',
    table: 'institution_stakeholders',
    text: 'You are about to submit a request to delete this Institution Stakeholder! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    required: 'The reason for your request to delete this record is required!',
    trigger: clickButton(/^Request deletion of /),
    row: (extra = {}) => ({
      id: 14,
      clientNumber: '4000004',
      StakeholderCategory: '1',
      ShareholderPercentage: '10',
      is_deleted: false,
      customer,
      ...extra,
    }),
    deleted: { is_deleted: true },
  },
  {
    name: 'branches list',
    component: BranchesPage,
    permission: 'Delete Branches',
    table: 'bank_branches',
    text: 'You are about to submit a request to delete this Branch! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    required: 'The reason for your request to delete this record is required!',
    trigger: clickButton(/^Request deletion of Kampala/),
    row: (extra = {}) => ({
      id: 15,
      BranchName: 'Kampala Main',
      bankBranchCode: '001',
      BranchIdentificationCode: '9001',
      DateOpened: '20100101',
      is_deleted: false,
      ...extra,
    }),
    deleted: { is_deleted: true },
  },
  {
    name: 'users list',
    component: UsersPage,
    permission: 'Create, Update and Delete Users',
    table: 'users',
    text: 'You are about to submit a request to delete this User! Proceed?',
    placeholder: 'Type your reason for deleting this user here...',
    required: 'The reason for your request to delete this user is required!',
    trigger: clickButton(/^Request deletion of /),
    row: (extra = {}) => ({
      id: 16,
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@kcb.test',
      status: 'enabled',
      role: 'admin',
      pendingDeletion: false,
      ...extra,
    }),
    deleted: { pendingDeletion: true },
  },
]

const page = (data: unknown[]) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 20, total: data.length, from: 1, to: data.length },
})

function mountWith(component: Component, permissions: string[], rows: unknown[], attach = false) {
  vi.mocked(http.get).mockImplementation(((url: string) =>
    Promise.resolve(url.startsWith('/reference') ? { data: [] } : page(rows))) as never)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    firstname: null,
    lastname: null,
    name: 'x',
    email: 'x@y.test',
    role: 'crb-officer',
    branchId: null,
    permissions,
  }
  return mount(component, {
    attachTo: attach ? document.body : undefined,
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: RouterLinkStub,
        CollateralModal: true,
        MapInstrumentsModal: true,
        PartyModal: true,
        ExistingCustomerModal: true,
        TransferDialog: true,
      },
    },
  })
}

describe.each(cases)('delete request button: $name', (c) => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(promptReason).mockReset()
    vi.mocked(submitDeletionRequest).mockReset()
    vi.mocked(swalNotification).mockReset()
  })

  it('is offered only with the delete permission', async () => {
    const without = mountWith(c.component, [], [c.row()])
    await flushPromises()
    expect(
      without.findAll('button').filter((b) => /Request deletion/.test(b.attributes('aria-label') ?? '')),
    ).toHaveLength(0)
    const withIt = mountWith(c.component, [c.permission], [c.row()])
    await flushPromises()
    expect(
      withIt.findAll('button').filter((b) => /Request deletion/.test(b.attributes('aria-label') ?? '')),
    ).toHaveLength(1)
  })

  it('asks for a reason with the old wording, files the request and flags the row without reloading', async () => {
    vi.mocked(promptReason).mockResolvedValue('Duplicate entry')
    vi.mocked(submitDeletionRequest).mockResolvedValue({ message: 'Deletion request submitted.', id: 5 })
    const w = mountWith(c.component, [c.permission], [c.row(), c.row({ id: 99 })])
    await flushPromises()
    expect(w.findAll(FLAG)).toHaveLength(0)
    await c.trigger(w)
    await flushPromises()

    expect(promptReason).toHaveBeenCalledWith('', c.text, c.placeholder, c.required)
    expect(submitDeletionRequest).toHaveBeenCalledWith({
      record_id: (c.row() as { id: number }).id,
      table_name: c.table,
      comment: 'Duplicate entry',
    })
    expect(swalNotification).toHaveBeenCalledWith('success', 'Deletion request submitted.')
    expect(w.findAll(FLAG)).toHaveLength(1)
    expect(vi.mocked(http.get).mock.calls.filter(([u]) => !String(u).startsWith('/reference'))).toHaveLength(
      1,
    )
  })

  it('does nothing when the reason box is cancelled', async () => {
    vi.mocked(promptReason).mockResolvedValue(null)
    const w = mountWith(c.component, [c.permission], [c.row()])
    await flushPromises()
    await c.trigger(w)
    await flushPromises()
    expect(submitDeletionRequest).not.toHaveBeenCalled()
    expect(w.findAll(FLAG)).toHaveLength(0)
  })

  it('shows the server message and leaves the row alone when the request is refused', async () => {
    vi.mocked(promptReason).mockResolvedValue('Because')
    vi.mocked(submitDeletionRequest).mockRejectedValue(
      Object.assign(new Error('A deletion request is already open for this record.'), {
        response: { status: 409 },
      }),
    )
    const w = mountWith(c.component, [c.permission], [c.row()])
    await flushPromises()
    await c.trigger(w)
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith(
      'error',
      'A deletion request is already open for this record.',
    )
    expect(w.findAll(FLAG)).toHaveLength(0)
  })

  it('shows the red flag instead of the actions for a record with a pending request', async () => {
    const w = mountWith(
      c.component,
      [
        c.permission,
        'Update Collateral',
        'Update Guarantors',
        'Update Stakeholder',
        'Update PIS',
        'Update Branches',
      ],
      [c.row(c.deleted)],
    )
    await flushPromises()
    expect(w.findAll(FLAG)).toHaveLength(1)
    expect(
      w.findAll('button').filter((b) => /Request deletion/.test(b.attributes('aria-label') ?? '')),
    ).toHaveLength(0)
  })
})

describe('delete request button: profiles list', () => {
  const profile = (extra = {}) => ({
    id: 7,
    clientNumber: '1000007',
    II_FCSNumber: null,
    full_name: 'Okello James ',
    customer_type: 'Individual',
    classificationCode: '0',
    ...extra,
  })
  const deleteButtons = (w: ReturnType<typeof mount>) =>
    w.findAll('button').filter((b) => b.text() === 'Delete')

  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(requestProfileDeletion).mockReset()
  })

  it('is offered only with Delete Profiles', async () => {
    const without = mountWith(ProfilesPage, ['View Profiles'], [profile()])
    await flushPromises()
    expect(deleteButtons(without)).toHaveLength(0)
    const withIt = mountWith(ProfilesPage, ['Delete Profiles'], [profile()])
    await flushPromises()
    expect(deleteButtons(withIt)).toHaveLength(1)
  })

  it('opens the multi-step dialog for the row and flags it once a request is filed', async () => {
    vi.mocked(requestProfileDeletion).mockResolvedValue(true)
    const w = mountWith(
      ProfilesPage,
      ['Delete Profiles'],
      [profile(), profile({ id: 8, clientNumber: '1000008' })],
    )
    await flushPromises()
    await deleteButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(requestProfileDeletion).toHaveBeenCalledWith(7)
    expect(w.findAll(FLAG)).toHaveLength(1)
    expect(deleteButtons(w)).toHaveLength(1)
    expect(vi.mocked(http.get)).toHaveBeenCalledTimes(1)
  })

  it('leaves the row alone when the dialog is cancelled or fails', async () => {
    vi.mocked(requestProfileDeletion).mockResolvedValue(false)
    const w = mountWith(ProfilesPage, ['Delete Profiles'], [profile()])
    await flushPromises()
    await deleteButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll(FLAG)).toHaveLength(0)
    expect(deleteButtons(w)).toHaveLength(1)
  })

  it('shows the flag, not the button, for a profile with a pending request', async () => {
    const w = mountWith(ProfilesPage, ['Delete Profiles'], [profile({ is_deleted: true })])
    await flushPromises()
    expect(w.findAll(FLAG)).toHaveLength(1)
    expect(deleteButtons(w)).toHaveLength(0)
  })
})

describe('delete request button: CAP list', () => {
  const app = (extra = {}) => ({
    id: 21,
    creditApplicationReference: 'KCB/CAP/202610/000021',
    clientNumber: '1000001',
    currency: 'UGX',
    Amount: '5000000',
    Term: '12',
    TermPeriod: 'Month',
    creditApplicationDate: '20261023',
    creditApplicationStatus: '2',
    jointAccountNumber: null,
    is_deleted: false,
    customer,
    ...extra,
  })

  async function openMenu(w: ReturnType<typeof mount>) {
    await w.get('button[aria-label="More actions"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
  }
  const deleteItem = () =>
    [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (e) => e.textContent?.trim() === 'Delete Loan',
    )

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.mocked(http.get).mockReset()
    vi.mocked(promptReason).mockReset()
    vi.mocked(submitDeletionRequest).mockReset()
    vi.mocked(swalNotification).mockReset()
  })

  it('shows Delete Loan in the menu only with Delete Applications', async () => {
    const without = mountWith(ApplicationsPage, [], [app()], true)
    await flushPromises()
    await openMenu(without)
    expect(document.body.textContent).toContain('Edit Loan')
    expect(deleteItem()).toBeUndefined()
    without.unmount()

    document.body.innerHTML = ''
    const withIt = mountWith(ApplicationsPage, ['Delete Applications'], [app()], true)
    await flushPromises()
    await openMenu(withIt)
    expect(deleteItem()).toBeDefined()
    withIt.unmount()
  })

  it('files the request with the CAP wording and flags the card', async () => {
    vi.mocked(promptReason).mockResolvedValue('Entered twice')
    vi.mocked(submitDeletionRequest).mockResolvedValue({ message: 'Deletion request submitted.', id: 1 })
    const w = mountWith(ApplicationsPage, ['Delete Applications'], [app()], true)
    await flushPromises()
    await openMenu(w)
    deleteItem()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(promptReason).toHaveBeenCalledWith(
      '',
      'You are about to submit a request to delete this Loan Application! Proceed?',
      'Type your reason for deleting this Loan Application here...',
      'The reason for your request to delete this Loan Application is required!',
    )
    expect(submitDeletionRequest).toHaveBeenCalledWith({
      record_id: 21,
      table_name: 'loan_applications',
      comment: 'Entered twice',
    })
    expect(w.findAll(FLAG)).toHaveLength(1)
    expect(w.text()).not.toContain('Loan Details')
    w.unmount()
  })
})
