import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() } }))
import { http } from '@/api/http'
import GlobalSearch from '@/components/layout/GlobalSearch.vue'

const results = {
  customers: [
    {
      title: 'Okello James Peter',
      subtitle: 'Client No: 1000001',
      badge: 'Individual',
      url: '/borrowers/1',
      action: { label: 'New Loan', url: '/applications/create/1000001' },
    },
  ],
  applications: [
    {
      title: 'KCB/CAP/202610/000001',
      subtitle: 'UGX 5,000,000',
      badge: 'Pending',
      url: '/applications/show/1',
      action: null,
    },
  ],
  loans: [],
}

async function type(text: string) {
  const w = mount(GlobalSearch, { global: { stubs: { RouterLink: RouterLinkStub } } })
  await w.find('input').setValue(text)
  vi.advanceTimersByTime(500)
  await flushPromises()
  return w
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(http.get).mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('waits for two characters before searching', async () => {
    const w = await type('a ')
    expect(http.get).not.toHaveBeenCalled()
    expect(w.text()).not.toContain('No customers')
  })

  it('shows each non-empty group with its items and action', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: results })
    const w = await type('okello james')
    expect(http.get).toHaveBeenCalledWith(
      '/search',
      expect.objectContaining({ params: { query: 'okello james' } }),
    )
    expect(w.text()).toContain('Customers')
    expect(w.text()).toContain('Credit applications (CAP)')
    expect(w.text()).not.toContain('Loans')
    expect(w.text()).toContain('Okello James Peter')
    expect(w.text()).toContain('New Loan')
    const links = w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(links).toContain('/borrowers/1')
    expect(links).toContain('/applications/show/1')
  })

  it('reads a failed search (a 403 for example) as no results', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('403'))
    const w = await type('zzzz')
    expect(w.text()).toContain('No customers, CAPs or loans match "zzzz"')
  })
})
