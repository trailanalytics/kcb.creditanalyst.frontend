import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('auth store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has no permissions when signed out', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.has('Download Crb Reports')).toBe(false)
  })

  it('reports permissions of the signed-in user', () => {
    const auth = useAuthStore()
    auth.user = { id: 1, name: 'Test', email: 't@example.com', role: 'admin', permissions: ['Sync T24'] }
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.has('Sync T24')).toBe(true)
    expect(auth.has('Delete Applications')).toBe(false)
  })
})
