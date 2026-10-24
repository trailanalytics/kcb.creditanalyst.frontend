import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/modules/processes/api', () => ({ processApi: { activeCount: vi.fn() } }))
import DashboardPage from '@/modules/dashboard/DashboardPage.vue'
import { processApi } from '@/modules/processes/api'
import { useAuthStore } from '@/stores/auth'

async function mountAs(permissions: string[]) {
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
  const w = mount(DashboardPage, { global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return w
}

describe('PROCESSES tile badge', () => {
  beforeEach(() => {
    vi.mocked(processApi.activeCount).mockReset()
  })

  it('shows the number of pending and running processes next to the title', async () => {
    vi.mocked(processApi.activeCount).mockResolvedValue(3)
    const w = await mountAs(['View Analysis'])
    expect(w.get('[data-testid=tile-badge]').text()).toBe('3')
    expect(w.findAllComponents(RouterLinkStub).some((l) => l.text().startsWith('PROCESSES'))).toBe(true)
  })

  it('shows no badge when nothing is running', async () => {
    vi.mocked(processApi.activeCount).mockResolvedValue(0)
    const w = await mountAs(['View Analysis'])
    expect(w.find('[data-testid=tile-badge]').exists()).toBe(false)
  })

  it('does not ask a user who cannot see the tile', async () => {
    const w = await mountAs([])
    expect(processApi.activeCount).not.toHaveBeenCalled()
    expect(w.find('[data-testid=tile-badge]').exists()).toBe(false)
  })

  it('shows no badge when the count cannot be read', async () => {
    vi.mocked(processApi.activeCount).mockRejectedValue(new Error('down'))
    const w = await mountAs(['View Analysis'])
    expect(w.find('[data-testid=tile-badge]').exists()).toBe(false)
  })
})
