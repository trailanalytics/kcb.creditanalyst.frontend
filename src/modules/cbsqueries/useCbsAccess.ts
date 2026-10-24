import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { MANAGE_CBS_QUERIES, REVIEW_CBS_QUERIES } from './permissions'

/** What the signed-in user may do here. Hiding is cosmetic: the server checks the permission and the role. */
export function useCbsAccess() {
  const auth = useAuthStore()
  return {
    canManage: computed(() => auth.has(MANAGE_CBS_QUERIES)),
    canReview: computed(() => auth.has(REVIEW_CBS_QUERIES)),
  }
}
