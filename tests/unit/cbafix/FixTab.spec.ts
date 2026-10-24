import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AxiosError } from 'axios'

vi.mock('@/modules/cbafix/api', () => ({
  cbaFixApi: { upload: vi.fn() },
  TEMPLATE_URLS: {
    'delete-records': '/api/v1/cba/fix/template/delete-records',
    'fix-customer': '/api/v1/cba/fix/template/fix-customer',
  },
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  swalOk: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
import FixTab from '@/modules/cbafix/components/FixTab.vue'
import { cbaFixApi } from '@/modules/cbafix/api'
import { swalNotification, swalOk } from '@/utils/dialogs'

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

async function mountTab(kind: 'delete' | 'customer') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cba/fix', component: { template: '<div />' } },
      { path: '/background-processes', component: { template: '<div />' } },
    ],
  })
  await router.push('/cba/fix')
  const w = mount(FixTab, { props: { kind }, global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

async function choose(w: Awaited<ReturnType<typeof mountTab>>['w'], kind: string, file: File) {
  const input = w.find(`[data-testid="${kind}-file"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

const csv = new File(['contractCode\nAA1\n'], 'codes.csv', { type: 'text/csv' })

describe('FixTab', () => {
  beforeEach(() => {
    vi.mocked(cbaFixApi.upload).mockReset()
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalOk.fire).mockClear()
  })

  it('the delete tab says what happens to the loan and offers its template', async () => {
    const { w } = await mountTab('delete')
    expect(w.text()).toContain('Upload Contract Codes to Delete')
    expect(w.text()).toContain('Tip')
    expect(w.text()).toContain('This action is irreversible.')
    expect(w.text()).toContain('Close the loan account as fully paid')
    expect(w.find('a[href="/api/v1/cba/fix/template/delete-records"]').exists()).toBe(true)
    expect(w.find('[data-testid="submit"]').text()).toBe('Delete Records')
    expect(w.find('[data-testid="submit"]').attributes('disabled')).toBeDefined()
  })

  it('the customer tab has the column mapping and no tip', async () => {
    const { w } = await mountTab('customer')
    expect(w.text()).toContain('Upload Customer Details to Fix')
    expect(w.text()).not.toContain('Tip')
    expect(w.text()).toContain('0 For Male or 1 For Female')
    expect(w.find('a[href="/api/v1/cba/fix/template/fix-customer"]').exists()).toBe(true)
    expect(w.find('[data-testid="submit"]').text()).toBe('Apply Fixes')
  })

  it('shows the chosen file name and enables the button', async () => {
    const { w } = await mountTab('delete')
    await choose(w, 'delete', csv)
    expect(w.text()).toContain('codes.csv')
    expect(w.find('[data-testid="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('uploads to the delete endpoint, then the dialog sends the user to the background processes', async () => {
    vi.mocked(cbaFixApi.upload).mockImplementation(async (_e, _f, onProgress) => {
      onProgress(100)
      return {
        message: 'Delete job queued. Track progress in Background Processes.',
        process_id: 9,
        bg_url: 'http://x.test/background-processes',
      }
    })
    const { w, router } = await mountTab('delete')
    await choose(w, 'delete', csv)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(cbaFixApi.upload).toHaveBeenCalledOnce()
    const [endpoint, body] = vi.mocked(cbaFixApi.upload).mock.calls[0]!
    expect(endpoint).toBe('delete-records')
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect(swalOk.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        html: 'Delete job queued. Track progress in Background Processes.',
        confirmButtonText: 'View Background Process',
      }),
    )
    expect(router.currentRoute.value.path).toBe('/background-processes')
  })

  it('the customer tab uses its own endpoint and a blue bar until the file is received', async () => {
    let resolve: (v: unknown) => void = () => undefined
    vi.mocked(cbaFixApi.upload).mockImplementation(
      (_e, _f, onProgress) =>
        new Promise((r) => {
          onProgress(40)
          resolve = r
        }) as never,
    )
    const { w } = await mountTab('customer')
    await choose(w, 'customer', csv)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(vi.mocked(cbaFixApi.upload).mock.calls[0]![0]).toBe('fix-customer-details')
    expect(w.find('[data-testid="submit"]').text()).toBe('Uploading...')
    expect(w.find('[role="progressbar"]').classes()).toContain('bg-primary-1')
    expect(w.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    resolve({ message: 'queued', process_id: 1, bg_url: '/background-processes' })
    await flushPromises()
  })

  it('shows the validation messages, resets the progress and keeps the file after a refusal', async () => {
    vi.mocked(cbaFixApi.upload).mockRejectedValue(
      failure(422, {
        detail: 'The given data was invalid.',
        errors: { file: ['The file must be a file of type: csv, txt, xlsx, xls.'] },
      }),
    )
    const { w } = await mountTab('delete')
    await choose(w, 'delete', csv)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith(
      'error',
      'The file must be a file of type: csv, txt, xlsx, xls.',
    )
    expect(w.find('[data-testid="progress"]').exists()).toBe(false)
    expect(w.text()).toContain('codes.csv')
    expect(w.find('[data-testid="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('refuses a file over the limit without sending it', async () => {
    const { w } = await mountTab('customer')
    const big = new File(['x'], 'big.csv')
    Object.defineProperty(big, 'size', { value: 51_200 * 1024 + 1 })
    await choose(w, 'customer', big)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(cbaFixApi.upload).not.toHaveBeenCalled()
    expect(swalNotification).toHaveBeenCalledWith(
      'error',
      'The file may not be greater than 51200 kilobytes.',
    )
  })
})
