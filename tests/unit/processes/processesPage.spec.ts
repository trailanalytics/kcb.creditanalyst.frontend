import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { process } from './processModel.spec'

vi.mock('@/modules/processes/api', () => ({
  processApi: {
    list: vi.fn(),
    status: vi.fn(),
    download: vi.fn(),
    kill: vi.fn(),
    override: vi.fn(),
    retry: vi.fn(),
    activeCount: vi.fn(),
  },
}))
vi.mock('@/modules/loans/download', () => ({
  saveBlob: vi.fn(),
  filenameOf: vi.fn(() => 'CB01120260930CBA.csv'),
  blobFailure: vi.fn(async (_e: unknown, fallback: string) => fallback),
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  swalDelete: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
import ProcessesPage from '@/modules/processes/ProcessesPage.vue'
import { processApi } from '@/modules/processes/api'
import { saveBlob } from '@/modules/loans/download'
import { swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { useAuthStore } from '@/stores/auth'
import type { BackgroundProcess } from '@/modules/processes/types'

const body = (data: BackgroundProcess[], current = 1, last = 1) => ({
  data,
  current_page: current,
  last_page: last,
  per_page: 20,
  total: data.length,
  from: 1,
  to: data.length,
})

async function mountPage(permissions: string[], rows: BackgroundProcess[], last = 1) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    firstname: 'A',
    lastname: 'B',
    name: 'A B',
    email: 'a@b.test',
    role: 'crb',
    branchId: null,
    permissions,
  }
  vi.mocked(processApi.list).mockResolvedValue(body(rows, 1, last))
  const w = mount(ProcessesPage, { global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } })
  await flushPromises()
  return w
}

describe('ProcessesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says so when there is nothing to show', async () => {
    const w = await mountPage([], [])
    expect(w.get('[data-testid=empty]').text()).toContain('No background processes found.')
    w.unmount()
  })

  it('shows the process, its label, bar and times; the owner has no manage column', async () => {
    const w = await mountPage(
      [],
      [
        process(1),
        process(2, { status: 'pending', started_at: null, progress: 0, progress_label: 'Queued...' }),
      ],
    )
    const first = w.get('[data-testid=process-1]')
    expect(first.text()).toContain('CBA Report Generation (20260931)')
    expect(first.text()).toContain('cba generation')
    expect(first.text()).toContain('Processing loan accounts... (300/650) | ETA: 12s')
    expect(first.get('[role=progressbar]').attributes('aria-valuenow')).toBe('40')
    expect(first.text()).not.toContain('Jane Doe')
    expect(w.get('[data-testid=process-2]').text()).toContain('24 Oct 2026 09:59 (queued)')
    expect(w.find('[data-testid=kill]').exists()).toBe(false)
    expect(w.findAll('th').map((t) => t.text())).toEqual([
      'Process',
      'Progress',
      'Started',
      'Completed',
      'Action',
    ])
    w.unmount()
  })

  it('gives a manager the owner names and the kill, mark complete and retry buttons by state', async () => {
    const w = await mountPage(
      ['Manage Background Processes'],
      [
        process(1),
        process(2, { status: 'completed', progress: 100, completed_at: '24 Oct 2026 10:05', has_file: true }),
        process(3, { status: 'failed', type: 'pr4_loan_update', error_message: 'x'.repeat(100) }),
        process(4, { status: 'failed', type: 'cba_cleanup' }),
      ],
    )
    expect(w.findAll('th').map((t) => t.text())).toContain('Manage')
    expect(w.get('[data-testid=process-1]').text()).toContain('Jane Doe')
    const buttons = (id: number) =>
      ['kill', 'override', 'retry'].filter((t) =>
        w.find(`[data-testid=process-${id}] [data-testid=${t}]`).exists(),
      )
    expect(buttons(1)).toEqual(['kill', 'override'])
    expect(buttons(2)).toEqual([])
    expect(buttons(3)).toEqual(['override', 'retry'])
    expect(buttons(4)).toEqual(['override'])
    // the error is cut at 80 characters and the whole text is the tooltip
    const error = w.get('[data-testid=process-3] [data-testid=error]')
    expect(error.text()).toContain(`${'x'.repeat(80)}…`)
    expect(error.attributes('title')).toBe('x'.repeat(100))
    w.unmount()
  })

  it('downloads the file of a finished process', async () => {
    const blob = new Blob(['x'])
    vi.mocked(processApi.download).mockResolvedValue({ data: blob, headers: {} } as never)
    const w = await mountPage([], [process(2, { status: 'completed', has_file: true })])
    await w.get('[data-testid=download]').trigger('click')
    await flushPromises()
    expect(processApi.download).toHaveBeenCalledWith(2)
    expect(saveBlob).toHaveBeenCalledWith(blob, 'CB01120260930CBA.csv')
    w.unmount()
  })

  it('tells the user when the file cannot be downloaded', async () => {
    vi.mocked(processApi.download).mockRejectedValue(new Error('404'))
    const w = await mountPage([], [process(2, { status: 'completed', has_file: true })])
    await w.get('[data-testid=download]').trigger('click')
    await flushPromises()
    expect(saveBlob).not.toHaveBeenCalled()
    expect(swalNotification).toHaveBeenCalledWith('error', 'The file could not be downloaded.')
    w.unmount()
  })

  it('opens the results of an analysis instead of a download', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const w = await mountPage(
      [],
      [process(5, { status: 'completed', result_url: 'http://x/analysis/pr4/results?batch_id=3' })],
    )
    await w.get('[data-testid=results]').trigger('click')
    expect(open).toHaveBeenCalledWith('http://x/analysis/pr4/results?batch_id=3', '_blank')
    open.mockRestore()
    w.unmount()
  })

  it('kills a process after asking, then reloads the page and shows the answer', async () => {
    vi.mocked(processApi.kill).mockResolvedValue({ message: 'Process killed successfully.' })
    const w = await mountPage(['Manage Background Processes'], [process(1, { title: 'CBA <b>x</b>' })])
    await w.get('[data-testid=kill]').trigger('click')
    await flushPromises()
    const asked = vi.mocked(swalDelete.fire).mock.calls[0]?.[0] as unknown as {
      title: string
      html: string
      confirmButtonText: string
    }
    expect(asked.title).toBe('Kill Process')
    expect(asked.confirmButtonText).toBe('Yes, Kill It')
    expect(asked.html).toContain('CBA &lt;b&gt;x&lt;/b&gt;')
    expect(processApi.kill).toHaveBeenCalledWith(1)
    expect(swalNotification).toHaveBeenCalledWith('success', 'Process killed successfully.')
    expect(processApi.list).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    vi.mocked(swalDelete.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    const w = await mountPage(['Manage Background Processes'], [process(1)])
    await w.get('[data-testid=kill]').trigger('click')
    await flushPromises()
    expect(processApi.kill).not.toHaveBeenCalled()
    w.unmount()
  })

  it('marks a process complete and retries a failed PR4 update', async () => {
    vi.mocked(processApi.override).mockResolvedValue({ message: 'Process marked as complete.' })
    vi.mocked(processApi.retry).mockResolvedValue({
      message: 'Retry queued successfully. 12 PR4 records will be processed.',
      new_process_id: 9,
    })
    const w = await mountPage(
      ['Manage Background Processes'],
      [process(3, { status: 'failed', type: 'pr4_loan_update' })],
    )
    await w.get('[data-testid=override]').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[0]?.[0]).toMatchObject({
      title: 'Mark as Complete',
      confirmButtonText: 'Yes, Mark Complete',
    })
    expect(processApi.override).toHaveBeenCalledWith(3)
    await w.get('[data-testid=retry]').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[1]?.[0]).toMatchObject({
      title: 'Retry Process',
      confirmButtonText: 'Yes, Retry',
    })
    expect(processApi.retry).toHaveBeenCalledWith(3)
    expect(swalNotification).toHaveBeenCalledWith(
      'success',
      'Retry queued successfully. 12 PR4 records will be processed.',
    )
    w.unmount()
  })

  it('shows the message of a refused action', async () => {
    vi.mocked(processApi.kill).mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Only pending or processing jobs can be killed.' } },
    })
    const w = await mountPage(['Manage Background Processes'], [process(1)])
    await w.get('[data-testid=kill]').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'Only pending or processing jobs can be killed.')
    w.unmount()
  })

  it('pages with Prev and Next and says how many there are', async () => {
    const w = await mountPage([], [process(1), process(2)], 3)
    expect(w.get('[data-testid=pagination]').text()).toContain('2 processes total')
    expect(w.get('[data-testid=pagination]').text()).toContain('Page 1 of 3')
    expect(w.get('[data-testid=prev]').attributes('disabled')).toBeDefined()
    vi.mocked(processApi.list).mockResolvedValue(body([process(21)], 2, 3))
    await w.get('[data-testid=next]').trigger('click')
    await flushPromises()
    expect(processApi.list).toHaveBeenLastCalledWith(2)
    expect(w.get('[data-testid=pagination]').text()).toContain('Page 2 of 3')
    expect(w.find('[data-testid=process-21]').exists()).toBe(true)
    w.unmount()
  })

  it('shows no pagination for a single page', async () => {
    const w = await mountPage([], [process(1)])
    expect(w.find('[data-testid=pagination]').exists()).toBe(false)
    w.unmount()
  })
})
