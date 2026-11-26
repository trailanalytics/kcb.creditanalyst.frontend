import { describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('@/modules/processes/api', () => ({ processApi: { activeCount: vi.fn(async () => 0) } }))
import DashboardPage from '@/modules/dashboard/DashboardPage.vue'
import { useAuthStore } from '@/stores/auth'

function titles(permissions: string[]) {
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
  const wrapper = mount(DashboardPage, {
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  })
  return wrapper.findAllComponents(RouterLinkStub).map((l) => l.text())
}

describe('dashboard tiles', () => {
  it('shows only the ungated tiles to a user without permissions', () => {
    const t = titles([])
    expect(t).toEqual(
      expect.arrayContaining(['CAP', 'CBA', 'BC', 'INSTITUTION', 'PIS', 'BS', 'CMC', 'CCG', 'FRA']),
    )
    expect(t).not.toContain('REPORTS')
    expect(t).not.toContain('ANALYSIS')
    expect(t).not.toContain('PROCESSES')
  })

  it('adds the gated tiles with their permission', () => {
    expect(titles(['Download Crb Reports'])).toContain('REPORTS')
    const t = titles(['View Analysis'])
    expect(t).toContain('ANALYSIS')
    expect(t).toContain('PROCESSES')
  })
})

describe('dashboard tile menus (UAT finding UD-08)', () => {
  function menuLabels(permissions: string[]) {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { id: 1, firstname: null, lastname: null, name: 'x', email: 'x@y.test', role: 'crb', branchId: null, permissions }
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub },
        { path: '/applications/report', component: stub, meta: { permission: 'Applications Report' } },
        { path: '/applications/bulk-approve', component: stub, meta: { permission: 'Approve/Reject Applications' } },
        { path: '/:rest(.*)*', component: stub },
      ],
    })
    const wrapper = mount(DashboardPage, { global: { plugins: [pinia, router], stubs: { RouterLink: RouterLinkStub } } })
    const cap = wrapper.findAllComponents({ name: 'DashboardTile' }).find((t) => (t.props('tile') as { title: string }).title === 'CAP')
    return ((cap?.props('tile') as { menu?: { label: string }[] }).menu ?? []).map((m) => m.label)
  }

  it('offers an entry only when the page it opens would let the user in', () => {
    expect(menuLabels([])).not.toContain('Bulk Approval')
    expect(menuLabels([])).not.toContain('Applications Report')
    expect(menuLabels([])).not.toContain('Joint Application')
    const approver = menuLabels(['Approve/Reject Applications', 'Applications Report'])
    expect(approver).toContain('Bulk Approval')
    expect(approver).toContain('Applications Report')
    expect(menuLabels(['Create Applications'])).toEqual(expect.arrayContaining(['Non Existing Customer', 'Joint Application']))
  })
})
