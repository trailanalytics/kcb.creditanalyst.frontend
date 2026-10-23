import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', () => ({
  http: { get: vi.fn() },
  messageOf: (_e: unknown, f: string) => f,
  problemOf: () => null,
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  swalDelete: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
vi.mock('@/modules/loans/api', () => ({ loansApi: { saveOffBalance: vi.fn(), deleteOffBalance: vi.fn() } }))
import { http } from '@/api/http'
import { loansApi } from '@/modules/loans/api'
import OffBalanceSheetItemsPage from '@/modules/loans/OffBalanceSheetItemsPage.vue'
import { swalNotification } from '@/utils/dialogs'
import { useAuthStore } from '@/stores/auth'

const item = (id: number) => ({
  id,
  contractCode: `OB-${id}`,
  customerName: `Customer ${id}`,
  contractType: 'Guarantee',
  amount: '5000000',
  contractDate: '2026-01-05',
  maturityDate: '20271231',
  clientNumber: null,
})
const page = (data: unknown[]) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 50, total: data.length, from: 1, to: data.length },
})

function mountPage(permissions = ['Update Off Balance Sheet Items', 'Delete Off Balance Sheet Items']) {
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
  return mount(OffBalanceSheetItemsPage, {
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('OffBalanceSheetItemsPage', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(loansApi.saveOffBalance).mockReset()
    vi.mocked(swalNotification).mockReset()
  })

  it('lists the items with dates as "5, Jan 2026" and amounts with separators', async () => {
    vi.mocked(http.get).mockResolvedValue(page([item(1)]) as never)
    const w = mountPage()
    await flushPromises()
    const text = w.find('[data-testid="item-row"]').text()
    expect(text).toContain('Customer 1')
    expect(text).toContain('5,000,000')
    expect(text).toContain('5, Jan 2026')
    expect(text).toContain('31, Dec 2027')
  })

  it('saves each client number against its own item and skips rows with nothing typed', async () => {
    vi.mocked(http.get).mockResolvedValue(page([item(1), item(2), item(3)]) as never)
    vi.mocked(loansApi.saveOffBalance).mockResolvedValue({
      message: 'ok',
      updated: 2,
      not_found: [],
      missing_items: [],
    })
    const w = mountPage()
    await flushPromises()
    const inputs = w.findAll('input[placeholder="client number"]')
    await inputs[2]!.setValue('100300')
    await inputs[0]!.setValue(' 100100 ')
    await inputs[1]!.setValue('none')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Save Changes')!
      .trigger('click')
    await flushPromises()
    expect(loansApi.saveOffBalance).toHaveBeenCalledWith([
      { id: 1, clientNumber: '100100' },
      { id: 3, clientNumber: '100300' },
    ])
  })

  it('asks for a client number when none was typed', async () => {
    vi.mocked(http.get).mockResolvedValue(page([item(1)]) as never)
    const w = mountPage()
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Save Changes')!
      .trigger('click')
    await flushPromises()
    expect(loansApi.saveOffBalance).not.toHaveBeenCalled()
    expect(swalNotification).toHaveBeenCalledWith(
      'error',
      'Please fill in a client number for at least 1 off balance sheet item and try again!',
    )
  })

  it('applies the date range as "start,end" from the first page, and ignores an empty range', async () => {
    vi.mocked(http.get).mockResolvedValue(page([item(1)]) as never)
    const w = mountPage()
    await flushPromises()
    const calls = vi.mocked(http.get).mock.calls.length
    await w
      .findAll('button')
      .find((b) => b.text() === 'Apply Filter')!
      .trigger('click')
    expect(vi.mocked(http.get).mock.calls.length).toBe(calls)

    await w.find('input[aria-label="Start date"]').setValue('2026-01-01')
    await w.find('input[aria-label="End date"]').setValue('2026-03-31')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Apply Filter')!
      .trigger('click')
    await flushPromises()
    expect(vi.mocked(http.get).mock.calls.at(-1)?.[1]).toMatchObject({
      params: { page: 1, queryFilter: '2026-01-01,2026-03-31' },
    })
  })

  it('hides Save and delete without the permissions', async () => {
    vi.mocked(http.get).mockResolvedValue(page([item(1)]) as never)
    const w = mountPage([])
    await flushPromises()
    expect(w.findAll('button').some((b) => b.text() === 'Save Changes')).toBe(false)
    expect(w.find('[aria-label="Delete OB-1"]').exists()).toBe(false)
  })
})
