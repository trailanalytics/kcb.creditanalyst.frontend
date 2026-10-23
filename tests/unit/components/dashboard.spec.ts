import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
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
