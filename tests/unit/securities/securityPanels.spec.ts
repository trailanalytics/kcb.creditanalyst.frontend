import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/modules/securities/api', () => ({
  securitiesApi: { overview: vi.fn() },
  collateralsApi: { attach: vi.fn() },
  guarantorsApi: { attach: vi.fn() },
}))
vi.mock('@/utils/dialogs', () => ({
  swalConfirm: { fire: vi.fn() },
  swalNotification: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { collateralsApi, guarantorsApi, securitiesApi } from '@/modules/securities/api'
import SecurityPanels from '@/modules/securities/components/SecurityPanels.vue'
import { resetSecuritySessions } from '@/modules/securities/useSecurities'
import { useAuthStore } from '@/stores/auth'
import { swalConfirm, swalNotification, toast } from '@/utils/dialogs'

const profile = (name: string, cn: string) => ({
  id: 1,
  full_name: name,
  clientNumber: cn,
  II_FCSNumber: '1234567890123',
  customer_type: 'Individual',
  classificationCode: '0',
})

const overview = (editable = true) => ({
  context: { type: 'application', reference: 'KCB/CAP/1', clientNumber: '1000001', editable },
  borrower: profile('Acme Traders ', '1000001'),
  collaterals: [
    {
      id: 1,
      CollateralReferenceNumber: 'KCB/CMC/2610/00001',
      cmc_type: 'Land and buildings',
      CollateralCurrency: 'UGX',
      CollateralOpenMarketValue: '5000000',
      CollateralDescription: 'Plot 12',
      attached: false,
    },
  ],
  guarantors: [
    {
      id: 11,
      GuarantorClientNumber: 'SGBG71',
      guarantor_profile: profile('Guy One ', 'SGBG71'),
      attached: true,
    },
    {
      id: 12,
      GuarantorClientNumber: 'SGBG72',
      guarantor_profile: profile('Guy Two ', 'SGBG72'),
      attached: false,
    },
  ],
  stakeholders: [
    { id: 21, StakeholderClientNumber: 'SGBS71', stakeholder_profile: profile('Sam Holder ', 'SGBS71') },
  ],
})

async function mountPanels(data = overview(), permissions: string[] = []) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { id: 1, name: 'T', email: 't@kcb.test', permissions } as never
  vi.mocked(securitiesApi.overview).mockResolvedValue(data as never)
  const w = mount(SecurityPanels, {
    props: { context: { type: 'application', referenceNumber: 'KCB/CAP/1' } },
    global: {
      stubs: {
        CollateralModal: true,
        PartyModal: true,
        ExistingCustomerModal: true,
        ExistingStakeholderModal: true,
      },
    },
  })
  await flushPromises()
  return w
}

const answer = (isConfirmed: boolean) =>
  vi.mocked(swalConfirm.fire).mockResolvedValue({ isConfirmed } as never)

describe('SecurityPanels', () => {
  beforeEach(() => {
    resetSecuritySessions()
    vi.clearAllMocks()
  })

  it('draws a panel per kind with a zero-padded count and the attached boxes ticked', async () => {
    const w = await mountPanels()
    expect(w.text()).toContain("Acme Traders's Collateral")
    expect(w.text()).toContain('01')
    expect(w.text()).toContain("Acme Traders's Guarantors")
    expect(w.text()).toContain('02')
    expect(w.text()).toContain("Acme Traders's Stakeholders")
    expect(w.text()).toContain('UGX 5,000,000')
    expect(w.text()).toContain('Fcs Number')
    expect(securitiesApi.overview).toHaveBeenCalledWith('KCB/CAP/1')
    expect((w.find('#guarantorCheck11').element as HTMLInputElement).checked).toBe(true)
    expect((w.find('#guarantorCheck12').element as HTMLInputElement).checked).toBe(false)
  })

  it('leaves out a panel when the borrower has none of that kind', async () => {
    const w = await mountPanels({ ...overview(), collaterals: [], stakeholders: [] })
    expect(w.text()).not.toContain('Collateral')
    expect(w.text()).not.toContain('Stakeholders')
    expect(w.text()).toContain('Guarantors')
  })

  it('attaches a guarantor after the user confirms and shows the server message', async () => {
    answer(true)
    vi.mocked(guarantorsApi.attach).mockResolvedValue({
      message: 'Guarantor Attached To Loan Successfully',
      attached: true,
    })
    const w = await mountPanels()
    await w.find('#guarantorCheck12').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[0]?.[0]).toMatchObject({
      title: 'Confirm?',
      text: 'Attach guarantor to Loan.',
    })
    expect(guarantorsApi.attach).toHaveBeenCalledWith('KCB/CAP/1', 12)
    expect((w.find('#guarantorCheck12').element as HTMLInputElement).checked).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('Guarantor Attached To Loan Successfully')
  })

  it('asks to remove an attached guarantor, and the box follows the answer from the server', async () => {
    answer(true)
    vi.mocked(guarantorsApi.attach).mockResolvedValue({
      message: 'Guarantor Removed From Loan Successfully',
      attached: false,
    })
    const w = await mountPanels()
    await w.find('#guarantorCheck11').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[0]?.[0]).toMatchObject({
      text: 'Remove guarantor from Loan',
    })
    expect((w.find('#guarantorCheck11').element as HTMLInputElement).checked).toBe(false)
  })

  it('changes nothing when the user cancels, and nothing is sent', async () => {
    answer(false)
    const w = await mountPanels()
    await w.find('#guarantorCheck12').trigger('click')
    await w.find('[id="collateralCheckKCB/CMC/2610/00001"]').trigger('click')
    await flushPromises()
    expect(guarantorsApi.attach).not.toHaveBeenCalled()
    expect(collateralsApi.attach).not.toHaveBeenCalled()
    expect((w.find('#guarantorCheck12').element as HTMLInputElement).checked).toBe(false)
    expect((w.find('[id="collateralCheckKCB/CMC/2610/00001"]').element as HTMLInputElement).checked).toBe(
      false,
    )
  })

  it('attaches collateral with the reference of the collateral', async () => {
    answer(true)
    vi.mocked(collateralsApi.attach).mockResolvedValue({
      message: 'Collateral Attached To Loan Successfully',
      attached: true,
    })
    const w = await mountPanels()
    await w.find('[id="collateralCheckKCB/CMC/2610/00001"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[0]?.[0]).toMatchObject({
      text: 'Attach Collateral to Loan.',
    })
    expect(collateralsApi.attach).toHaveBeenCalledWith('KCB/CAP/1', 'KCB/CMC/2610/00001')
  })

  it('shows the refusal and keeps the box as it was when the server says no', async () => {
    answer(true)
    vi.mocked(guarantorsApi.attach).mockRejectedValue(new Error('conflict'))
    const w = await mountPanels()
    await w.find('#guarantorCheck12').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', expect.any(String))
    expect((w.find('#guarantorCheck12').element as HTMLInputElement).checked).toBe(false)
  })

  it('locks the boxes when the application is no longer pending', async () => {
    const w = await mountPanels(overview(false))
    expect((w.find('#guarantorCheck12').element as HTMLInputElement).disabled).toBe(true)
    await w.find('#guarantorCheck12').trigger('click')
    expect(swalConfirm.fire).not.toHaveBeenCalled()
  })

  it('always shows stakeholders ticked and disabled', async () => {
    const w = await mountPanels()
    const box = w.find('input[aria-label="Stakeholder SGBS71"]').element as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
  })

  it('offers Edit only to users who may update that kind of record', async () => {
    expect((await mountPanels()).findAll('button[aria-label$="actions"]')).toHaveLength(0)
    resetSecuritySessions()
    const w = await mountPanels(overview(), ['Update Guarantors'])
    expect(w.findAll('button[aria-label$="actions"]').map((b) => b.attributes('aria-label'))).toEqual([
      'Guarantor actions',
      'Guarantor actions',
    ])
  })
})
