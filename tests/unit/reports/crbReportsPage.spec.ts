import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AxiosError } from 'axios'

vi.mock('@/modules/reports/api', () => ({
  reportsApi: { download: vi.fn(), generateCba: vi.fn() },
}))
vi.mock('@/modules/loans/download', async (orig) => ({
  ...(await orig<typeof import('@/modules/loans/download')>()),
  saveBlob: vi.fn(),
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  swalOk: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
import CrbReportsPage from '@/modules/reports/CrbReportsPage.vue'
import { reportsApi } from '@/modules/reports/api'
import { saveBlob } from '@/modules/loans/download'
import { swalNotification, swalOk, toast } from '@/utils/dialogs'

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports/crb', component: { template: '<div />' } },
      { path: '/background-processes', component: { template: '<div />' } },
    ],
  })
  await router.push('/reports/crb')
  const w = mount(CrbReportsPage, { global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } } })
  return { w, router }
}

const hidden = (w: Awaited<ReturnType<typeof mountPage>>['w'], id: string) =>
  (w.get(`[data-testid="${id}"]`).element as HTMLElement).style.display === 'none'

describe('CrbReportsPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.download).mockReset()
    vi.mocked(reportsApi.generateCba).mockReset()
    vi.mocked(saveBlob).mockReset()
    vi.mocked(swalOk.fire).mockClear()
    vi.mocked(swalNotification).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('opens on BC with From, To and Version shown and the extras hidden', async () => {
    const { w } = await mountPage()
    expect(w.text()).toContain('Credit Bureau Reports')
    expect(w.text()).toContain('Note: some reports like CBA are heavy')
    expect(hidden(w, 'from-block')).toBe(false)
    expect(hidden(w, 'to-block')).toBe(false)
    expect(hidden(w, 'short-cba')).toBe(true)
    expect(hidden(w, 'instruments')).toBe(true)
    expect((w.get('#file_name').element as HTMLSelectElement).value).toBe('BC')
    expect(w.find('option[value="CML"]').attributes('disabled')).toBeDefined()
  })

  it('shows what each type needs', async () => {
    const { w } = await mountPage()
    await w.get('#file_name').setValue('CBA')
    expect(hidden(w, 'from-block')).toBe(true)
    expect(hidden(w, 'short-cba')).toBe(false)
    await w.get('#file_name').setValue('CMC')
    expect(hidden(w, 'short-cba')).toBe(true)
    expect(hidden(w, 'instruments')).toBe(false)
    expect(w.text()).toContain('only choose this option if the Bureau requires instruments of claim codes')
    await w.get('#file_name').setValue('PI')
    expect(hidden(w, 'to-block')).toBe(true)
    expect(hidden(w, 'version-block')).toBe(false)
  })

  it('downloads a file report with the dates of the form and saves it under the name the server gives', async () => {
    const blob = new Blob(['"H"'])
    vi.mocked(reportsApi.download).mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="CB01120260930BC.csv"' },
    } as never)
    const { w } = await mountPage()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(reportsApi.download).toHaveBeenCalledWith('BC', {
      fromDate: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      toDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      version: '8.0',
    })
    expect(saveBlob).toHaveBeenCalledWith(blob, 'CB01120260930BC.csv')
    expect(toast.success).toHaveBeenCalled()
  })

  it('shows the reason a report could not be generated', async () => {
    vi.mocked(reportsApi.download).mockRejectedValue(
      failure(422, new Blob([JSON.stringify({ errors: { toDate: ['The to date is not a valid date.'] } })])),
    )
    const { w } = await mountPage()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(saveBlob).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('The to date is not a valid date.')
  })

  it('does not call the server for a date that does not exist', async () => {
    const { w } = await mountPage()
    await w.get('select[name="to_day"]').setValue('31')
    await w.get('select[name="to_month"]').setValue('2')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(reportsApi.download).not.toHaveBeenCalled()
    expect(swalNotification).toHaveBeenCalledWith('error', 'Please choose a valid To date.')
  })

  it('queues CBA through the CBA call and goes to the background processes', async () => {
    vi.mocked(reportsApi.generateCba).mockResolvedValue({ process_id: 12 })
    const { w, router } = await mountPage()
    await w.get('#file_name').setValue('CBA')
    await w.get('input[name="use_cached_cba"]').setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(reportsApi.generateCba).toHaveBeenCalledWith({
      toDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      version: '8.0',
      useCached: true,
    })
    expect(reportsApi.download).not.toHaveBeenCalled()
    expect(vi.mocked(swalOk.fire).mock.calls[0]?.[0]).toMatchObject({
      html: 'CBA report generation has been queued and is running in the background.',
    })
    expect(router.currentRoute.value.path).toBe('/background-processes')
  })

  it('shows the running-process answer with a way to the progress page', async () => {
    vi.mocked(reportsApi.generateCba).mockRejectedValue(
      failure(409, { detail: 'A CBA generation or cleanup is already running.' }),
    )
    const { w, router } = await mountPage()
    await w.get('#file_name').setValue('CBA')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(vi.mocked(swalOk.fire).mock.calls[0]?.[0]).toMatchObject({
      icon: 'error',
      html: 'A CBA generation or cleanup is already running.',
      confirmButtonText: 'View Progress →',
    })
    expect(router.currentRoute.value.path).toBe('/background-processes')
  })

  it('stays on the page when the user does not follow the progress link', async () => {
    vi.mocked(reportsApi.generateCba).mockResolvedValue({ process_id: 3 })
    vi.mocked(swalOk.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    const { w, router } = await mountPage()
    await w.get('#file_name').setValue('CBA')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/reports/crb')
  })
})
