import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/api/http', () => ({ messageOf: (_e: unknown, f: string) => f, http: {} }))
vi.mock('@/utils/dialogs', () => ({ swalNotification: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }), RouterLink: {} }))
vi.mock('@/modules/loans/api', () => ({ loansApi: { view: vi.fn(), repayments: vi.fn() } }))
import { loansApi } from '@/modules/loans/api'
import LoanShowPage from '@/modules/loans/LoanShowPage.vue'
import RepaymentsPage from '@/modules/loans/RepaymentsPage.vue'
import type { LoanView } from '@/modules/loans/types'

const view = (extra: Partial<LoanView> = {}): LoanView =>
  ({
    loan: {
      id: 3,
      contractCode: 'AA003',
      clientNumber: '1000001',
      currency: 'UGX',
      creditAmount: '1',
      currentBalanceAmount: '1',
      creditAccountStatus: '5',
    },
    customer: {
      id: 7,
      clientNumber: '1000001',
      II_FCSNumber: null,
      full_name: 'Okello James  ',
      customer_type: 'Individual',
      classificationCode: '0',
      currentAccount: null,
      branchCode: '001',
      individual_details: { II_CountryID: 'CM88' },
      non_individual_details: null,
    },
    header: {
      amount: 'UGX 1,234,568',
      contractCode: 'AA003',
      contractDate: '15 Jan 2025',
      maturityDate: '15 Jan 2027',
      currentBalance: 'UGX 1,000,000',
      status: 'Current',
      loanType: 'Term Loan',
      purpose: 'Working capital',
      balanceOverdue: 'UGX 0',
      dueDays: '0',
      arrearsDate: null,
    },
    ...extra,
  }) as unknown as LoanView

const mountPage = (component: typeof LoanShowPage | typeof RepaymentsPage) =>
  mount(component, { props: { id: '3' }, global: { stubs: { RouterLink: RouterLinkStub } } })

describe('LoanShowPage', () => {
  beforeEach(() => vi.mocked(loansApi.view).mockReset())

  it('shows the header facts and keeps the full details hidden until asked', async () => {
    vi.mocked(loansApi.view).mockResolvedValue(
      view({
        groups: [
          {
            title: 'Account',
            rows: [{ label: 'Contract Code', value: 'AA003' }, { label: 'Loan Category' }],
          },
          { title: 'Amounts', rows: [{ label: 'Credit Amount', value: 'UGX 1,234,567.50' }] },
        ],
      }),
    )
    const w = mountPage(LoanShowPage)
    await flushPromises()
    const facts = w.find('[data-testid="loan-facts"]').text()
    expect(facts).toContain('UGX 1,234,568')
    expect(facts).toContain('15 Jan 2025')
    expect(facts).toContain('UGX 1,000,000')
    expect(facts).toContain('Working capital')
    expect(w.find('[data-testid="loan-groups"]').exists()).toBe(false)

    await w
      .findAll('button')
      .find((b) => b.text() === 'Show / Hide')!
      .trigger('click')
    const groups = w.find('[data-testid="loan-groups"]')
    expect(groups.text()).toContain('Account')
    expect(groups.text()).toContain('UGX 1,234,567.50')
    // a loan without a value shows a dash
    expect(
      groups
        .findAll('tr')
        .find((r) => r.text().includes('Loan Category'))!
        .text(),
    ).toContain('—')
  })
})

describe('RepaymentsPage', () => {
  beforeEach(() => vi.mocked(loansApi.repayments).mockReset())

  it('numbers the repayments and shows the count', async () => {
    vi.mocked(loansApi.repayments).mockResolvedValue(
      view({
        repayments: [
          { no: 1, paymentDate: '31-Mar-2025', paymentAmount: '175,000', lastStatusChangeDate: 'N/F' },
          {
            no: 2,
            paymentDate: '28-Feb-2025',
            paymentAmount: '150,000',
            lastStatusChangeDate: '01-Mar-2025',
          },
        ],
      }),
    )
    const w = mountPage(RepaymentsPage)
    await flushPromises()
    expect(w.find('[data-testid="repayment-count"]').text()).toBe('2')
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('31-Mar-2025')
    expect(rows[0]!.text()).toContain('N/F')
    expect(w.text()).toContain("Okello James's Repayments for Account AA003")
  })

  it('says when there are no repayments', async () => {
    vi.mocked(loansApi.repayments).mockResolvedValue(view({ repayments: [] }))
    const w = mountPage(RepaymentsPage)
    await flushPromises()
    expect(w.text()).toContain('No repayments found at the moment!')
    expect(w.find('table').exists()).toBe(false)
  })
})
