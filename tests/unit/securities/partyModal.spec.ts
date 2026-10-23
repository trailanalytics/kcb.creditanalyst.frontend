import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http')>()),
  http: { get: vi.fn(async () => ({ data: [] })) },
}))
vi.mock('@/modules/securities/api', () => ({
  guarantorsApi: { create: vi.fn(), update: vi.fn() },
  stakeholdersApi: { create: vi.fn(), update: vi.fn() },
  collateralsApi: { create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { MSG_REQUIRED } from '@/modules/customer/profileRules'
import { collateralsApi, guarantorsApi, stakeholdersApi } from '@/modules/securities/api'
import { MSG_FCS } from '@/modules/securities/checks'
import CollateralModal from '@/modules/securities/components/CollateralModal.vue'
import PartyModal from '@/modules/securities/components/PartyModal.vue'
import { MSG_FORCED_SALE } from '@/modules/securities/collateralModel'
import type { CollateralRow, PartyKind, PartyStart, SecurityContext } from '@/modules/securities/types'
import { swalNotification, toast } from '@/utils/dialogs'
import { completeCustomer } from './fixtures'

const context: SecurityContext = { type: 'application', referenceNumber: 'KCB/CAP/1' }

async function mountParty(kind: PartyKind, start: PartyStart, ctx: SecurityContext | null = context) {
  setActivePinia(createPinia())
  const w = mount(PartyModal, {
    props: { kind, start, version: 1, context: ctx ?? undefined, open: true },
    attachTo: document.body,
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  return w
}

const form = () => document.body.querySelector('form') as HTMLFormElement
async function fill(name: string, value: string) {
  const el = document.body.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement
  el.value = value
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'))
  await flushPromises()
}
/** The modal's own fields, which an existing customer does not bring with it. */
async function fillGuarantee(fcs?: string) {
  await fill('ValueOfGuarantorsCollateral', '5000000')
  await fill('GuaranteeType', '0')
  await fill('GuarantorType', '0')
  if (fcs) await fill('II_FCSNumber', fcs)
}
const submit = async () => {
  form().dispatchEvent(new Event('submit', { cancelable: true }))
  await flushPromises()
}

describe('PartyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('refuses an empty form with the red-border message and sends nothing', async () => {
    await mountParty('guarantor', { mode: 'new', classification: '0' })
    await submit()
    expect(toast.error).toHaveBeenCalledWith(MSG_REQUIRED)
    expect(guarantorsApi.create).not.toHaveBeenCalled()
  })

  it('posts an existing customer as a guarantor of the application and closes with a success toast', async () => {
    vi.mocked(guarantorsApi.create).mockResolvedValue({ id: 5 } as never)
    const w = await mountParty('guarantor', { mode: 'existing', customer: completeCustomer() as never })
    expect((document.body.querySelector('input[aria-label="Client number"]') as HTMLInputElement).value).toBe(
      'SGBG71007',
    )
    expect(document.body.textContent).toContain('Add Guarantor')
    await submit()
    expect(toast.error).toHaveBeenCalledWith(MSG_REQUIRED) // the guarantee fields are still empty
    expect(guarantorsApi.create).not.toHaveBeenCalled()
    await fillGuarantee()
    await submit()
    expect(guarantorsApi.create).toHaveBeenCalledTimes(1)
    const body = vi.mocked(guarantorsApi.create).mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      referenceNumber: 'KCB/CAP/1',
      profile_id: '7',
      ValueOfGuarantorsCollateral: '5000000',
      GuaranteeType: '0',
      GSCAFB_Surname: 'Okello',
      branchCode: '001',
    })
    expect(toast.success).toHaveBeenCalledWith(' Guarantor Saved Successfully')
    expect(w.emitted('update:open')?.at(-1)).toEqual([false])
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('stops on the FCS number rule before any request', async () => {
    const customer = completeCustomer()
    customer.II_FCSNumber = '12345'
    await mountParty('guarantor', { mode: 'existing', customer: customer as never })
    await fillGuarantee()
    await submit()
    expect(toast.error).toHaveBeenCalledWith(MSG_FCS)
    expect(guarantorsApi.create).not.toHaveBeenCalled()
  })

  it('edits a stakeholder row with a PUT by id, without the application context from the list page', async () => {
    vi.mocked(stakeholdersApi.update).mockResolvedValue({ id: 9 } as never)
    const row = {
      id: 9,
      stakeholder_profile: completeCustomer('stakeholder'),
      ShareholderPercentage: '40',
      StakeholderCategory: '1',
    }
    await mountParty('stakeholder', { mode: 'edit', row: row as never }, null)
    expect(document.body.textContent).toContain('Update Stakeholder')
    expect(document.body.querySelector('select[aria-label="Classification"]')?.hasAttribute('disabled')).toBe(
      true,
    )
    await submit()
    expect(stakeholdersApi.update).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ ShareholderPercentage: '40' }),
    )
    expect(vi.mocked(stakeholdersApi.update).mock.calls[0]?.[1]).not.toHaveProperty('referenceNumber')
    expect(stakeholdersApi.create).not.toHaveBeenCalled()
  })

  it('shows the server message and keeps the dialog open to correct when the save is refused', async () => {
    vi.mocked(guarantorsApi.create).mockRejectedValue(
      Object.assign(new Error('x'), {
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            detail:
              'A borrower cannot be a guarantor of itself! Please select/capture a different guarantor.',
          },
        },
      }),
    )
    const w = await mountParty('guarantor', { mode: 'existing', customer: completeCustomer() as never })
    await fillGuarantee()
    await submit()
    expect(swalNotification).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('cannot be a guarantor of itself'),
    )
    expect(w.emitted('update:open')?.map((e) => e[0])).toEqual([false, true])
    expect(w.emitted('saved')).toBeUndefined()
  })
})

describe('CollateralModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  const collateral = {
    id: 3,
    CollateralType: '1',
    CollateralCurrency: 'UGX',
    CollateralForcedSaleValue: '4000000',
    CollateralOpenMarketValue: '5000000',
    ValuationDate: '20261001',
    CollateralExpiryDate: '20271231',
    InstrumentofClaim: 'Land Title',
    CollateralDescription: 'Plot 12',
  } as CollateralRow

  async function mountCollateral(item: CollateralRow | null, ctx?: SecurityContext) {
    setActivePinia(createPinia())
    const w = mount(CollateralModal, {
      props: { collateral: item, context: ctx, open: false },
      attachTo: document.body,
      global: { plugins: [createPinia()] },
    })
    await w.setProps({ open: true })
    await flushPromises()
    return w
  }

  it('fills the form from the collateral being edited and saves it by id', async () => {
    vi.mocked(collateralsApi.update).mockResolvedValue(collateral)
    const w = await mountCollateral(collateral, context)
    expect(document.body.textContent).toContain('Update Collateral')
    expect((document.body.querySelector('#cm-valuation') as HTMLInputElement).value).toBe('2026-10-01')
    await submit()
    expect(collateralsApi.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        referenceNumber: 'KCB/CAP/1',
        CollateralForcedSaleValue: '4000000',
        expiryDate: '2027-12-31',
      }),
    )
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('adds a collateral for the application when none is being edited, and refuses a zero forced sale value', async () => {
    await mountCollateral(null, context)
    expect(document.body.textContent).toContain('Add Collateral')
    await submit()
    expect(toast.error).toHaveBeenCalledWith(MSG_FORCED_SALE)
    expect(collateralsApi.create).not.toHaveBeenCalled()
  })
})
