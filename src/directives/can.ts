import type { Directive } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * `v-can="'Download Crb Reports'"` hides the element unless the user holds the permission.
 * Hiding is cosmetic only: the server enforces every permission.
 */
export const can: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    if (!useAuthStore().has(binding.value)) el.style.display = 'none'
  },
}
