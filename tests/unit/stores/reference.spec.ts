import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '@/api/http'
import { useReferenceStore } from '@/stores/reference'

describe('reference store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps every lookup when several load at once', async () => {
    const answers: Record<string, unknown[]> = {
      '/reference/nationalities': [{ code: 'UG', value: 'Uganda' }],
      '/reference/uganda-regions': [{ code: 'C', value: 'Central' }],
      '/reference/branches': [{ id: 1, code: '001', value: 'Kampala Main' }],
    }
    // answered in the opposite order to the requests, which is what exposed the overwriting
    vi.spyOn(http, 'get').mockImplementation(async (url: string) => {
      await new Promise((r) => setTimeout(r, url.includes('nationalities') ? 20 : 1))
      return { data: answers[url] } as never
    })
    const store = useReferenceStore()
    await store.load('nationalities', 'uganda-regions', 'branches')
    expect(store.items('nationalities')).toHaveLength(1)
    expect(store.items('uganda-regions')).toHaveLength(1)
    expect(store.branchName('001')).toBe('Kampala Main')
  })

  it('fetches a lookup once', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: [{ code: 'S', value: 'Single' }] } as never)
    const store = useReferenceStore()
    await Promise.all([store.load('marital-statuses'), store.load('marital-statuses')])
    await store.load('marital-statuses')
    expect(get).toHaveBeenCalledTimes(1)
    expect(store.label('marital-statuses', 'S')).toBe('Single')
    expect(store.label('marital-statuses', 'X')).toBe('X')
  })
})
