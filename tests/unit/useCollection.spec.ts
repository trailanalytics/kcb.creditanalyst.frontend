import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() } }))
import { http } from '@/api/http'
import { useCollection } from '@/composables/useCollection'

const get = vi.mocked(http.get)
const page = (data: { id: number }[], to: number, total: number) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 2, total, from: 1, to },
})

function make() {
  const scope = effectScope()
  return scope.run(() => useCollection<{ id: number }>('/things', { debounceMs: 10 }))!
}

describe('useCollection', () => {
  beforeEach(() => get.mockReset())

  it('appends pages and completes when to === total', async () => {
    get
      .mockResolvedValueOnce(page([{ id: 1 }, { id: 2 }], 2, 3))
      .mockResolvedValueOnce(page([{ id: 3 }], 3, 3))
    const c = make()
    await c.loadMore()
    expect(c.items.value.map((i) => i.id)).toEqual([1, 2])
    expect(c.completed.value).toBe(false)
    await c.loadMore()
    expect(c.items.value.map((i) => i.id)).toEqual([1, 2, 3])
    expect(c.completed.value).toBe(true)
    expect(get).toHaveBeenLastCalledWith('/things', { params: { search: null, page: 2, queryFilter: '' } })
  })

  it('completes on an empty page', async () => {
    get.mockResolvedValueOnce(page([], 0, 0))
    const c = make()
    await c.loadMore()
    expect(c.completed.value).toBe(true)
    await c.loadMore()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('restarts from page 1 when the search changes (debounced)', async () => {
    get.mockResolvedValue(page([{ id: 1 }], 1, 1))
    const c = make()
    await c.loadMore()
    c.search.value = 'abc'
    await nextTick()
    await new Promise((r) => setTimeout(r, 40))
    expect(get).toHaveBeenLastCalledWith('/things', { params: { search: 'abc', page: 1, queryFilter: '' } })
    expect(c.items.value).toHaveLength(1)
  })

  it('ignores a response that arrives after a newer reset', async () => {
    let release: (v: unknown) => void = () => {}
    get.mockReturnValueOnce(new Promise((r) => (release = r)) as never)
    const c = make()
    const first = c.loadMore()
    c.reset()
    release(page([{ id: 9 }], 1, 1))
    await first
    expect(c.items.value).toEqual([])
  })

  it('updates and deletes items by id', () => {
    const c = make()
    c.addItem({ id: 1 })
    c.updateItem({ id: 1, extra: true } as never)
    expect((c.items.value[0] as never as { extra: boolean }).extra).toBe(true)
    c.deleteItem(1)
    expect(c.items.value).toEqual([])
  })
})
