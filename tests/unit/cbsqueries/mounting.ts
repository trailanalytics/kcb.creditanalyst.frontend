import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { useAuthStore } from '@/stores/auth'

/** Mount a page with a signed-in user holding the given permissions and the router pieces stubbed. */
export function mountPage(
  component: Component,
  permissions: string[],
  props: Record<string, unknown> = {},
): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    firstname: null,
    lastname: null,
    name: 'x',
    email: 'x@y.test',
    role: 'crb-officer',
    branchId: null,
    permissions,
  }
  return mount(component, {
    props,
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  })
}

export const push = vi.fn()
