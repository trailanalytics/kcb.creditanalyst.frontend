import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))
import { http } from '@/api/http'
import router from '@/router'
import { useAuthStore, type CurrentUser } from '@/stores/auth'

const me = (role: string | null, permissions: string[]): CurrentUser => ({
  id: 1,
  firstname: 'A',
  lastname: 'B',
  name: 'A B',
  email: 'a@b.test',
  role,
  branchId: null,
  permissions,
})

async function go(path: string, user: CurrentUser | null) {
  setActivePinia(createPinia())
  const get = vi.mocked(http.get)
  get.mockReset()
  if (user) get.mockResolvedValue({ data: user })
  else get.mockRejectedValue(new Error('401'))
  await router.replace('/login') // reset
  await router.push(path).catch(() => undefined)
  await router.isReady()
  return router.currentRoute.value
}

describe('route guards', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sends signed-out visitors to the login page, remembering where they were going', async () => {
    const r = await go('/users', null)
    expect(r.name).toBe('login')
    expect(r.query.redirect).toBe('/users')
  })

  it('keeps a signed-in user away from the login page', async () => {
    expect((await go('/login', me('crb', []))).name).toBe('home')
  })

  it('shows 403 when the permission is missing, and the page when it is held', async () => {
    const denied = await go('/users', me('admin', ['View Profiles']))
    expect(denied.name).toBe('error')
    expect(denied.params.code).toBe('403')
    expect((await go('/users', me('admin', ['Manage Users']))).name).toBe('users')
  })

  it('gates permission-protected placeholder pages like the Laravel controllers do', async () => {
    expect((await go('/t24', me('crb', []))).params.code).toBe('403')
    expect((await go('/t24', me('crb', ['Sync T24']))).path).toBe('/t24')
  })

  it('lets only admins and CRB officers into /admin', async () => {
    expect((await go('/admin', me('crb', []))).name).toBe('home')
    expect((await go('/admin', me('crb-officer', []))).name).toBe('admin')
    expect((await go('/admin', me('admin', []))).name).toBe('admin')
  })

  it('maps unknown URLs to the 404 page', async () => {
    const r = await go('/no/such/page', me('crb', []))
    expect(r.params.code).toBe('404')
  })

  it('does not grant anything through the role alone', async () => {
    // role admin without the permission row is denied, as in hasPermission()
    expect((await go('/logs', me('admin', []))).params.code).toBe('403')
  })
})

describe('CBS query routes', () => {
  it('opens the overview with either permission and refuses a user with neither', async () => {
    expect((await go('/cbs-queries', me('crb', []))).params.code).toBe('403')
    expect((await go('/cbs-queries', me('crb', ['Manage Users']))).params.code).toBe('403')
    expect((await go('/cbs-queries', me('crb', ['Manage CBS Queries']))).name).toBe('cbs-queries')
    expect((await go('/cbs-queries/events', me('crb', ['Review CBS Queries']))).name).toBe('cbs-events')
    expect((await go('/cbs-queries/versions/7', me('crb', ['Review CBS Queries']))).name).toBe('cbs-version')
  })

  it('keeps the editor for Manage and the review page for Review', async () => {
    expect((await go('/cbs-queries/versions/7/edit', me('crb', ['Review CBS Queries']))).params.code).toBe(
      '403',
    )
    expect((await go('/cbs-queries/versions/7/edit', me('crb', ['Manage CBS Queries']))).name).toBe(
      'cbs-edit',
    )
    expect((await go('/cbs-queries/versions/7/review', me('crb', ['Manage CBS Queries']))).params.code).toBe(
      '403',
    )
    expect((await go('/cbs-queries/versions/7/review', me('crb', ['Review CBS Queries']))).name).toBe(
      'cbs-review',
    )
  })
})

describe('auth store', () => {
  it('exposes admin helpers', () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = me('crb-officer', ['X'])
    expect(auth.isAdmin).toBe(false)
    expect(auth.canSeeAdmin).toBe(true)
  })
})
