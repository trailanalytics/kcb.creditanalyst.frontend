import { onBeforeUnmount, ref, watch } from 'vue'
import { http } from '@/api/http'

/** Laravel paginator JSON, as returned by every list endpoint (ADR 4). */
export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface CollectionOptions {
  /** Extra query params sent with every request. */
  params?: () => Record<string, unknown>
  /** Debounce for the search box, same as the old mixin. */
  debounceMs?: number
}

/**
 * Infinite list. Port of resources/js/mixins/collection.js: `search` (debounced 800 ms), `queryFilter`, page counter,
 * stops when a page is empty or `to === total`. Unlike the mixin, changing the search or filter clears the list and starts
 * again from page 1, and later pages are appended (the mixin dropped earlier pages while a search was active).
 */
export function useCollection<T extends { id?: number | string }>(
  url: string,
  options: CollectionOptions = {},
) {
  const items = ref<T[]>([]) as { value: T[] }
  const search = ref<string | null>(null)
  const queryFilter = ref('')
  const page = ref(1)
  const loading = ref(false)
  const completed = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function loadMore() {
    if (loading.value || completed.value) return
    const mine = generation
    loading.value = true
    try {
      const { data } = await http.get<Paginated<T>>(url, {
        params: {
          search: search.value,
          page: page.value,
          queryFilter: queryFilter.value,
          ...(options.params?.() ?? {}),
        },
      })
      if (mine !== generation) return // a newer search started while this request was running
      if (data.data.length) {
        page.value += 1
        items.value.push(...data.data)
      }
      if (data.data.length === 0 || data.to === data.total) completed.value = true
    } catch (e) {
      error.value = e
      completed.value = true
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  function reset() {
    generation += 1
    items.value = []
    page.value = 1
    completed.value = false
    loading.value = false
    error.value = null
  }

  async function reload() {
    reset()
    await loadMore()
  }

  function changeFilter(filter: string) {
    queryFilter.value = filter
    void reload()
  }

  watch(search, () => {
    clearTimeout(timer)
    timer = setTimeout(() => void reload(), options.debounceMs ?? 800)
  })
  onBeforeUnmount(() => clearTimeout(timer))

  const addItem = (item: T) => items.value.unshift(item)
  const deleteItem = (id: number | string) => {
    items.value = items.value.filter((i) => i.id !== id)
  }
  const updateItem = (data: Partial<T> & { id: number | string }) => {
    const found = items.value.find((i) => i.id === data.id)
    if (found) Object.assign(found, data)
  }

  return {
    items,
    search,
    queryFilter,
    page,
    loading,
    completed,
    error,
    loadMore,
    reload,
    reset,
    changeFilter,
    addItem,
    deleteItem,
    updateItem,
  }
}
