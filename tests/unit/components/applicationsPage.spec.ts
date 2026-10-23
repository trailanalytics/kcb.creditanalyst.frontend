import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() } }))
import { http } from '@/api/http'
import ApplicationsPage from '@/modules/application/ApplicationsPage.vue'

const row = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  creditApplicationReference: `KCB/CAP/202610/00000${id}`,
  clientNumber: '1000001',
  currency: 'UGX',
  Amount: '5000000',
  Term: '12',
  TermPeriod: 'Month',
  creditApplicationDate: '20261023',
  creditApplicationStatus: status,
  jointAccountNumber: null,
  is_deleted: false,
  customer: {
    id: 1,
    full_name: 'Okello James Peter ',
    customer_type: 'Individual',
    clientNumber: '1000001',
    classificationCode: '0',
    individual_details: { II_CountryID: 'CM88' },
    non_individual_details: null,
  },
  ...extra,
})

const page = (data: unknown[]) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 50, total: data.length, from: 1, to: data.length },
})

describe('ApplicationsPage', () => {
  beforeEach(() => vi.mocked(http.get).mockReset())

  it('lists applications with the amounts, terms and statuses the old list showed', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, '2'), row(2, '0'), row(3, '5')]) as never)
    const w = mount(ApplicationsPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Okello James Peter')
    expect(text).toContain('KCB/CAP/202610/000001')
    expect(text).toContain('UGX 5,000,000')
    expect(text).toContain('12 Months')
    expect(text).toContain('20261023')
    expect(['Pending', 'Approved', 'Rejected'].every((s) => text.includes(s))).toBe(true)
    expect(text).toContain('NIN: CM88')
  })

  it('shows a deletion flag instead of actions for a record with a pending deletion request', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, '2', { is_deleted: true })]) as never)
    const w = mount(ApplicationsPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    expect(w.find('[title="This record has been requested to be deleted!"]').exists()).toBe(true)
    expect(w.text()).not.toContain('Loan Details')
  })

  it('reloads from the first page with the chosen filter', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, '2')]) as never)
    const w = mount(ApplicationsPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    await w.find('select').setValue('rejected')
    await flushPromises()
    const last = vi.mocked(http.get).mock.calls.at(-1)
    expect(last?.[1]).toMatchObject({ params: { page: 1, queryFilter: 'rejected' } })
  })
})
