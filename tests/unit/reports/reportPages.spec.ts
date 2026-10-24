import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/api/http', async (orig) => ({
  ...(await orig<typeof import('@/api/http')>()),
  http: { get: vi.fn() },
}))
vi.mock('@/modules/reports/api', () => ({
  reportsApi: { analysis: vi.fn(), analysisPdf: vi.fn() },
}))
vi.mock('@/modules/loans/download', async (orig) => ({
  ...(await orig<typeof import('@/modules/loans/download')>()),
  saveBlob: vi.fn(),
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
}))
import { http } from '@/api/http'
import { reportsApi } from '@/modules/reports/api'
import { saveBlob } from '@/modules/loans/download'
import LoansWithoutPage from '@/modules/reports/LoansWithoutPage.vue'
import SubmissionAnalysisPage from '@/modules/reports/SubmissionAnalysisPage.vue'
import type { SubmissionAnalysis } from '@/modules/reports/types'

const analysis = (over: Partial<SubmissionAnalysis> = {}): SubmissionAnalysis => ({
  generated_on: '2026-10-24',
  stakeholders: { count: 0, as_of: '24-Oct-2026', rows: [] },
  bounced_cheques: { count: 0, min_date: '', max_date: '', by_currency: [], by_branch: [], by_reason: [] },
  credit_applications: {
    count: 2,
    min_date: '01-Sep-2026',
    max_date: '30-Sep-2026',
    by_currency: [{ currency: 'UGX', count: 2, amount: 7500000 }],
    by_branch: [
      { code: '001', name: 'Kampala Main', count: 1 },
      { code: '999', name: 'N/F', count: 1 },
    ],
    by_product: [{ code: '10', label: 'Overdraft', count: 2 }],
    by_status: [{ code: '0', label: 'Pending', count: 2 }],
  },
  credit_accounts: {
    count: 1500,
    min_date: '01-Jan-2020',
    max_date: '30-Sep-2026',
    by_currency: [{ currency: 'UGX', count: 1500, balance: 123456789.4 }],
    by_branch: [],
    by_product: [],
    by_status: [],
    by_risk: [{ code: '1', label: 'Substandard', count: 4 }],
    largest: [{ name: 'Acme Ltd', reference: 'AA1', amount: 90000000, currency: 'UGX' }],
    worst: [{ name: ' ', reference: 'AA2', days: 400 }],
  },
  ...over,
})

describe('SubmissionAnalysisPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.analysis).mockReset()
    vi.mocked(reportsApi.analysisPdf)
      .mockReset()
      .mockResolvedValue({ data: new Blob(['%PDF']), headers: {} } as never)
    vi.mocked(saveBlob).mockReset()
  })
  const mountPage = async (id?: string) => {
    const w = mount(SubmissionAnalysisPage, {
      props: { id },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    return w
  }

  it('shows only the sections that have records, with dates, real codes and formatted numbers', async () => {
    vi.mocked(reportsApi.analysis).mockResolvedValue(analysis())
    const w = await mountPage('view')
    expect(w.find('[data-testid="stakeholders"]').exists()).toBe(false)
    expect(w.find('[data-testid="bounced"]').exists()).toBe(false)
    const text = w.text()
    expect(text).toContain('Credit Applications (2)')
    expect(text).toContain('Minimum date: 01-Sep-2026')
    expect(text).toContain('Maximum date: 30-Sep-2026')
    expect(text).toContain('7,500,000')
    expect(text).toContain('Kampala Main')
    expect(text).toContain('code: 001')
    expect(text).toContain('N/F')
    expect(text).toContain('Credit Borrower Accounts (1,500)')
    expect(text).toContain('123,456,789')
    expect(text).toContain('Substandard')
    expect(text).toContain('Acme Ltd')
    expect(text).toContain('90,000,000 UGX')
    expect(text).toContain('Contract: AA2')
    expect(text).toContain('Unnamed customer')
    expect(saveBlob).not.toHaveBeenCalled()
  })

  it('leaves the card blank when every count is zero', async () => {
    vi.mocked(reportsApi.analysis).mockResolvedValue(
      analysis({
        credit_applications: { ...analysis().credit_applications, count: 0 },
        credit_accounts: { ...analysis().credit_accounts, count: 0 },
      }),
    )
    const w = await mountPage()
    expect(w.findAll('[data-testid="analysis-table"]')).toHaveLength(0)
  })

  it('saves the PDF on /download and from the button', async () => {
    vi.mocked(reportsApi.analysis).mockResolvedValue(analysis())
    const w = await mountPage('download')
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'submission_analysis.pdf')
    await w.get('[data-testid="pdf"]').trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledTimes(2)
  })
})

describe('LoansWithoutPage', () => {
  beforeEach(() => vi.mocked(http.get).mockReset())

  it('lists the loans and links the eye to the absolute loan page', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            contractCode: 'AA001',
            clientNumber: '100',
            creditAmount: '5000000',
            currency: 'UGX',
            contractDate: '20250905',
            maturityDate: '20270905',
            lackFactor: 'without_ccg',
            loan_id: 42,
            name: 'Okello James',
          },
        ],
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 1,
        from: 1,
        to: 1,
      },
    } as never)
    const w = mount(LoansWithoutPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('AA001')
    expect(text).toContain('Okello James')
    expect(text).toContain('without_ccg')
    expect(text).toContain('5, Sep 2025')
    expect(text).toContain('UGX 5,000,000')
    expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe('/reports/loans-without-cmc-ccg-bs')
    const links = w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(links).toContain('/loans/show/42')
  })
})
