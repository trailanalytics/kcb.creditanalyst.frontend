import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { processApi } from './api'
import { ACTIVE_POLL_MS, FULL_REFRESH_MS, applyUpdate, isActive } from './processModel'
import type { BackgroundProcess } from './types'

/**
 * The list of the Background Processes page (BackgroundProcesses.vue): page 1 on load, every 4 seconds the status of each process that is
 * pending or processing, every 2 minutes the whole current page again. Failures of the polls are ignored, the next tick tries again.
 */
export function useProcesses(api: Pick<typeof processApi, 'list' | 'status'> = processApi) {
  const processes = ref<BackgroundProcess[]>([])
  const currentPage = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const loading = ref(true)
  const lastUpdated = ref<string | null>(null)
  let activePoll: ReturnType<typeof setInterval> | undefined
  let fullRefresh: ReturnType<typeof setInterval> | undefined

  const stamp = () => (lastUpdated.value = new Date().toLocaleTimeString())

  async function fetchPage(page: number) {
    loading.value = true
    try {
      const body = await api.list(page)
      processes.value = body.data
      currentPage.value = body.current_page
      lastPage.value = body.last_page
      total.value = body.total
      stamp()
    } catch {
      // the page keeps what it has
    } finally {
      loading.value = false
    }
  }

  async function pollActive() {
    const running = processes.value.filter(isActive)
    if (!running.length) return
    await Promise.all(
      running.map((p) =>
        api
          .status(p.id)
          .then((update) => (processes.value = applyUpdate(processes.value, update)))
          .catch(() => undefined),
      ),
    )
    stamp()
  }

  async function start() {
    await fetchPage(1)
    stop()
    activePoll = setInterval(() => void pollActive(), ACTIVE_POLL_MS)
    fullRefresh = setInterval(() => void fetchPage(currentPage.value), FULL_REFRESH_MS)
  }

  function stop() {
    clearInterval(activePoll)
    clearInterval(fullRefresh)
    activePoll = undefined
    fullRefresh = undefined
  }

  if (getCurrentInstance()) onBeforeUnmount(stop)

  return { processes, currentPage, lastPage, total, loading, lastUpdated, fetchPage, start, stop }
}
