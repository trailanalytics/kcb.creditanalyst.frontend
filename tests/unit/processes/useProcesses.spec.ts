import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { process } from './processModel.spec'
import { useProcesses } from '@/modules/processes/useProcesses'
import type { ProcessUpdate } from '@/modules/processes/types'

const page = (
  data = [process(1), process(2, { status: 'completed' }), process(3, { status: 'pending' })],
  current = 1,
  last = 1,
) => ({
  data,
  current_page: current,
  last_page: last,
  per_page: 20,
  total: data.length,
  from: 1,
  to: data.length,
})

const update = (id: number, extra: Partial<ProcessUpdate> = {}): ProcessUpdate => ({
  id,
  type: 'cba_generation',
  title: 't',
  status: 'processing',
  progress: 60,
  progress_label: 'later',
  has_file: false,
  result_url: null,
  error_message: null,
  completed_at: null,
  ...extra,
})

describe('useProcesses', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads page 1 first', async () => {
    const api = { list: vi.fn().mockResolvedValue(page()), status: vi.fn() }
    const p = useProcesses(api)
    await p.start()
    expect(api.list).toHaveBeenCalledWith(1)
    expect(p.processes.value.map((x) => x.id)).toEqual([1, 2, 3])
    expect(p.loading.value).toBe(false)
    expect(p.lastUpdated.value).not.toBeNull()
    p.stop()
  })

  it('asks for the status of each running process every four seconds, and only those', async () => {
    const api = {
      list: vi.fn().mockResolvedValue(page()),
      status: vi
        .fn()
        .mockImplementation(async (id: number) =>
          update(id, id === 3 ? { status: 'completed', progress: 100, has_file: true } : {}),
        ),
    }
    const p = useProcesses(api)
    await p.start()
    await vi.advanceTimersByTimeAsync(3999)
    expect(api.status).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.status.mock.calls.map((c) => c[0])).toEqual([1, 3])
    expect(p.processes.value.find((x) => x.id === 1)?.progress).toBe(60)
    expect(p.processes.value.find((x) => x.id === 3)).toMatchObject({ status: 'completed', has_file: true })
    // the finished one is not asked about again
    await vi.advanceTimersByTimeAsync(4000)
    expect(api.status.mock.calls.map((c) => c[0])).toEqual([1, 3, 1])
    p.stop()
  })

  it('does nothing while no process is running', async () => {
    const api = {
      list: vi.fn().mockResolvedValue(page([process(2, { status: 'completed' })])),
      status: vi.fn(),
    }
    const p = useProcesses(api)
    await p.start()
    await vi.advanceTimersByTimeAsync(12000)
    expect(api.status).not.toHaveBeenCalled()
    p.stop()
  })

  it('reads the current page again every two minutes', async () => {
    const api = {
      list: vi.fn().mockResolvedValue(page([process(2, { status: 'completed' })], 2, 3)),
      status: vi.fn(),
    }
    const p = useProcesses(api)
    await p.start()
    expect(p.currentPage.value).toBe(2)
    expect(p.lastPage.value).toBe(3)
    await vi.advanceTimersByTimeAsync(119999)
    expect(api.list).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(api.list).toHaveBeenLastCalledWith(2)
    p.stop()
  })

  it('keeps what it has when a poll or a refresh fails', async () => {
    const api = {
      list: vi.fn().mockResolvedValueOnce(page()).mockRejectedValue(new Error('down')),
      status: vi.fn().mockRejectedValue(new Error('down')),
    }
    const p = useProcesses(api)
    await p.start()
    await vi.advanceTimersByTimeAsync(120000)
    expect(p.processes.value).toHaveLength(3)
    expect(p.loading.value).toBe(false)
    p.stop()
  })

  it('stops polling when stopped', async () => {
    const api = { list: vi.fn().mockResolvedValue(page()), status: vi.fn().mockResolvedValue(update(1)) }
    const p = useProcesses(api)
    await p.start()
    p.stop()
    await vi.advanceTimersByTimeAsync(130000)
    expect(api.status).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledTimes(1)
  })
})
