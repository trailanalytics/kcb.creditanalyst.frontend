import { onMounted, ref, type Ref } from 'vue'
import { cbsApi } from './api'
import { statusOf } from './feedback'
import { messageOf } from '@/api/http'
import type { VersionDetail } from './types'

/** Loads GET /versions/{id} and reloads it after an action. A refused or missing version leaves a message for the page to show. */
export function useVersionDetail(id: Ref<number>, api: Pick<typeof cbsApi, 'version'> = cbsApi) {
  const version = ref<VersionDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    try {
      version.value = await api.version(id.value)
      error.value = null
    } catch (e) {
      const status = statusOf(e)
      error.value =
        status === 404
          ? 'This version was not found.'
          : status === 403
            ? messageOf(e, 'You do not have access to this version.')
            : messageOf(e, 'The version could not be loaded. Please refresh and try again.')
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { version, loading, error, reload: load }
}
