import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() } }))
import { http } from '@/api/http'
import LoanList from '@/modules/loans/components/LoanList.vue'
import { useAuthStore } from '@/stores/auth'

const row = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  contractCode: `AA00${id}`,
  clientNumber: '1000001',
  contractDate: '20250115',
  maturityDate: '20270115',
  currency: 'UGX',
  creditAmount: '1234567',
  currentBalanceAmount: '750000',
  creditAccountStatus: status,
  loan_type: 'Term Loan',
  customer: { id: 7, full_name: 'Okello James  ', customer_type: 'Individual', clientNumber: '1000001' },
  ...extra,
})

const page = (data: unknown[]) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 50, total: data.length, from: 1, to: data.length },
})

function mountList(
  permissions: string[],
  props: { url: string; variant?: 'loan' | 'writeoff' } = { url: '/loans' },
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    firstname: null,
    lastname: null,
    name: 'x',
    email: 'x@y.test',
    role: 'crb',
    branchId: null,
    permissions,
  }
  return mount(LoanList, { props, global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } })
}

describe('LoanList', () => {
  beforeEach(() => vi.mocked(http.get).mockReset())

  it('shows each loan with its amount, type, dates and status label', async () => {
    vi.mocked(http.get).mockResolvedValue(
      page([row(1, '5'), row(2, '1', { loan_type: 'Overdraft' }), row(3, '9')]) as never,
    )
    const w = mountList([])
    await flushPromises()
    const rows = w.findAll('[data-testid="loan-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('AA001')
    expect(rows[0]!.text()).toContain('UGX 1,234,567')
    expect(rows[0]!.text()).toContain('Term Loan')
    expect(rows[0]!.text()).toContain('20250115')
    expect(rows[0]!.text()).toContain('Current')
    expect(rows[1]!.text()).toContain('Overdue')
    // an unknown status code renders empty, as in the old list
    expect(rows[2]!.text()).not.toMatch(/Current|Closed|Overdue|Written/)
    expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe('/loans')
  })

  it('links the borrower name to the profile only when the user may view profiles', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, '5')]) as never)
    const plain = mountList([])
    await flushPromises()
    expect(
      plain.findAllComponents(RouterLinkStub).filter((l) => l.props('to') === '/borrowers/7'),
    ).toHaveLength(0)
    expect(plain.text()).toContain('Okello James')

    const linked = mountList(['View Profiles'])
    await flushPromises()
    expect(linked.findAllComponents(RouterLinkStub).some((l) => l.props('to') === '/borrowers/7')).toBe(true)
  })

  it('falls back to a placeholder name and offers Loan Details by default', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(4, '5', { customer: null })]) as never)
    const w = mountList([])
    await flushPromises()
    expect(w.text()).toContain('Unnamed customer')
    const details = w.findAllComponents(RouterLinkStub).find((l) => l.text() === 'Loan Details')
    expect(details?.props('to')).toBe('/loans/show/4')
  })

  it('the write-off variant shows the current balance and puts the contract date under the amount', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, '3')]) as never)
    const w = mountList([], { url: '/write-offs', variant: 'writeoff' })
    await flushPromises()
    const text = w.find('[data-testid="loan-row"]').text()
    expect(text).toContain('Current Balance')
    expect(text).toContain('UGX 750,000')
    expect(text).toContain('Written Off')
    expect(text).not.toContain('Contract Date')
  })
})
