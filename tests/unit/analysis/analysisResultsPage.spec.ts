import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/modules/analysis/api', () => ({ analysisApi: { results: vi.fn() } }))
vi.mock('@/utils/dialogs', () => ({ showLoader: vi.fn(), hideLoader: vi.fn() }))
vi.mock('@/api/http', () => ({ messageOf: (_e: unknown, fallback: string) => fallback }))
const route = { query: {} as Record<string, string> }
vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  useRoute: () => route,
}))
import AnalysisResultsPage from '@/modules/analysis/AnalysisResultsPage.vue'
import { analysisApi } from '@/modules/analysis/api'
import { hideLoader, showLoader } from '@/utils/dialogs'

const results = {
  id: 3,
  batch_id: 8,
  reporting_month: '2026-09-30',
  pr4_records_count: '1250',
  cba_records_count: '98765',
  matching_records_count: '1200',
  matching_records_percentage: '96',
  balance_records_count: '1250',
  balance_records_percentage: '100',
  matching_balance_count: '1100',
  matching_balance_percentage: '91.67',
  installment_records_count: '1250',
  installment_records_percentage: '100',
  matching_installment_count: '1000',
  matching_installment_percentage: '83.33',
  arrears_records_count: '1250',
  arrears_records_percentage: '100',
  matching_arrears_count: '1190',
  matching_arrears_percentage: '99.17',
  pr4_float_loans_records_count: '50',
  pr4_float_loans_records_percentage: '4',
}

const mountPage = async () => {
  const w = mount(AnalysisResultsPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return w
}

describe('AnalysisResultsPage', () => {
  beforeEach(() => {
    route.query = {}
    vi.mocked(analysisApi.results).mockReset()
    vi.mocked(showLoader).mockClear()
    vi.mocked(hideLoader).mockClear()
  })

  it('shows the whole text of the analysis', async () => {
    vi.mocked(analysisApi.results).mockResolvedValue(results as never)
    const w = await mountPage()
    expect(showLoader).toHaveBeenCalledWith('loading results...')
    expect(hideLoader).toHaveBeenCalled()
    expect(w.text()).toContain('Pr4 Report File Analyzed against the CBA successfully!')
    expect(w.text()).toContain('Results of the analysis')
    expect(w.text()).toContain('Reporting month: 30 Sep 2026')
    const items = w.findAll('[data-testid="results"] li').map((li) => li.text())
    expect(items).toEqual([
      '1,250 records found in the Pr4 File compared against 98,765 records in the CBA.',
      '1,200 (96%) records found in the Pr4 File were also found in the CBA.',
      '1,250 (100%) records found in the Pr4 have a balance, of these, 1,100 (91.67%) have identical balances of the same record in the CBA.',
      '1,250 (100%) records found in the Pr4 have installment amount, of these, 1,000 (83.33%) have identical installment amount of the same record in the CBA.',
      '1,250 (100%) records found in the Pr4 are in arrears, of these, 1,190 (99.17%) have identical arrears days and amounts of the same record in the CBA.',
      '1,250 records found in the Pr4 File, of these, 50 (4%) are KCB AIRTEL AGENT FLOAT LOAN and are not reported in the CBA.',
    ])
    expect(w.find('[data-testid="line-float"]').classes()).toContain('text-danger')
    expect(w.findAll('[data-testid="line-matching"] b').map((b) => b.text())).toEqual(['1,200', '96%'])
    expect(w.find('[data-testid="empty"]').exists()).toBe(false)
  })

  it('says so when nothing has been analysed', async () => {
    vi.mocked(analysisApi.results).mockResolvedValue(null)
    const w = await mountPage()
    expect(w.find('[data-testid="empty"]').text()).toContain('No analysis has been run yet.')
    expect(w.find('[data-testid="results"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Analyzed against the CBA successfully')
  })

  it('shows the failure instead of leaving the spinner up', async () => {
    vi.mocked(analysisApi.results).mockRejectedValue(new Error('down'))
    const w = await mountPage()
    expect(hideLoader).toHaveBeenCalled()
    expect(w.find('[role="alert"]').text()).toContain('The results could not be loaded. Please try again.')
    expect(w.find('[data-testid="empty"]').exists()).toBe(false)
  })

  it('asks for the analysis of one upload when the address names its batch', async () => {
    route.query = { batch_id: '8' }
    vi.mocked(analysisApi.results).mockResolvedValue(results as never)
    await mountPage()
    expect(analysisApi.results).toHaveBeenCalledWith(8)
    route.query = { batch_id: 'abc' }
    await mountPage()
    expect(analysisApi.results).toHaveBeenLastCalledWith(undefined)
  })
})
