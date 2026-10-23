import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { http } from '@/api/http'

export interface CurrentUser {
  id: number
  name: string
  email: string
  role: string
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const permissions = computed(() => new Set(user.value?.permissions ?? []))
  const isAuthenticated = computed(() => user.value !== null)

  function has(permission: string): boolean {
    return permissions.value.has(permission)
  }

  /** GET /api/v1/me (added with JUL-147). */
  async function load() {
    try {
      const { data } = await http.get<CurrentUser>('/me')
      user.value = data
    } catch {
      user.value = null
    }
  }

  function clear() {
    user.value = null
  }

  return { user, isAuthenticated, has, load, clear }
})
