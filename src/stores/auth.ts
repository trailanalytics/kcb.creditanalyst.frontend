import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { http } from '@/api/http'

/** GET /api/v1/me */
export interface CurrentUser {
  id: number
  firstname: string | null
  lastname: string | null
  name: string
  email: string
  role: string | null
  branchId: number | null
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const loaded = ref(false)
  const permissions = computed(() => new Set(user.value?.permissions ?? []))
  const isAuthenticated = computed(() => user.value !== null)
  const role = computed(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  /** The /admin pages accept admins and CRB officers (Laravel's `admin` middleware). */
  const canSeeAdmin = computed(() => role.value === 'admin' || role.value === 'crb-officer')

  /** Authorisation is the permission names only; the role grants nothing (same as hasPermission() in Laravel). */
  function has(permission: string): boolean {
    return permissions.value.has(permission)
  }

  async function load() {
    try {
      const { data } = await http.get<CurrentUser>('/me')
      user.value = data
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(email: string, password: string) {
    const { data } = await http.post<CurrentUser>('/auth/login', { email, password })
    user.value = data
    loaded.value = true
  }

  async function logout() {
    try {
      await http.post('/auth/logout')
    } finally {
      user.value = null
    }
  }

  function clear() {
    user.value = null
  }

  return { user, loaded, isAuthenticated, role, isAdmin, canSeeAdmin, has, load, login, logout, clear }
})
