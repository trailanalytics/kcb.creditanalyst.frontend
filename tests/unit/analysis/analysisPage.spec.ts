import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AxiosError } from 'axios'

vi.mock('@/modules/analysis/api', () => ({ analysisApi: { upload: vi.fn(), results: vi.fn() } }))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  swalOk: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
}))
import AnalysisPage from '@/modules/analysis/AnalysisPage.vue'
import { analysisApi } from '@/modules/analysis/api'
import { previousMonthEnd } from '@/modules/analysis/analysisModel'
import { swalNotification, swalOk } from '@/utils/dialogs'

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

const DateStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input data-testid="date" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/analysis', component: { template: '<div />' } },
      { path: '/background-processes', component: { template: '<div />' } },
      { path: '/analysis/pr4/results', component: { template: '<div />' } },
    ],
  })
  await router.push('/analysis')
  const w = mount(AnalysisPage, {
    global: { plugins: [router], stubs: { DateField: DateStub, RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return { w, router }
}

const csv = new File(['TRANS_ID\nAA1'], 'pr4.csv', { type: 'text/csv' })

async function chooseFile(w: Awaited<ReturnType<typeof mountPage>>['w']) {
  w.findComponent({ name: 'DropFile' }).vm.$emit('file', csv)
  await flushPromises()
}

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.mocked(analysisApi.upload).mockReset()
    vi.mocked(analysisApi.results).mockReset().mockResolvedValue(null)
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalOk.fire).mockClear()
  })

  it('starts on the previous month end with the update action and the analysis note hidden', async () => {
    const { w } = await mountPage()
    expect((w.find('[data-testid="date"]').element as HTMLInputElement).value).toBe(previousMonthEnd())
    expect((w.find('#actionSelect').element as HTMLSelectElement).value).toBe('')
    expect(w.find('[data-testid="submit"]').text()).toContain('UPDATE CBA REPORT')
    expect(w.text()).not.toContain('will be uploaded and analyzed')
    expect(w.find('[data-testid="progress"]').exists()).toBe(false)
    await w.find('#actionSelect').setValue('analyse_pr4')
    expect(w.find('[data-testid="submit"]').text()).toContain('ANALYZE PR4 AGAINST CBA')
    expect(w.text()).toContain('The PR4 file will be uploaded and analyzed against the CBA report.')
  })

  it('shows the four messages in order and sends nothing', async () => {
    const { w } = await mountPage()
    await w.find('[data-testid="date"]').setValue('')
    await w.find('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith(
      'error',
      'Please make sure the submission date is selected!',
    )
    await w.find('[data-testid="date"]').setValue('2026-09-15')
    await w.find('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith(
      'error',
      'Submission date must be the last day of a month (e.g. 31 Mar, 30 Apr).',
    )
    await w.find('[data-testid="date"]').setValue('2026-09-30')
    await w.find('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith(
      'error',
      'Please enter a valid exchange rate greater than 0!',
    )
    await w.find('#exchange_rate').setValue('3765')
    await w.find('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith('error', 'Please make sure the PR4 file is attached!')
    expect(analysisApi.upload).not.toHaveBeenCalled()
  })

  it('uploads with analyze as chosen, then offers the background processes page and goes there', async () => {
    vi.mocked(analysisApi.upload).mockResolvedValue({
      message: 'PR4 file queued for background processing.',
      process_id: 9,
      bg_url: 'https://credit.kcb.test/background-processes',
    })
    const { w, router } = await mountPage()
    await w.find('[data-testid="date"]').setValue('2026-09-30')
    await w.find('#exchange_rate').setValue('3765')
    await w.find('#actionSelect').setValue('analyse_pr4')
    await chooseFile(w)
    await w.find('form').trigger('submit')
    await flushPromises()

    const body = vi.mocked(analysisApi.upload).mock.calls[0]![0] as FormData
    expect(body.get('reporting_month')).toBe('2026-09-30')
    expect(body.get('exchange_rate')).toBe('3765')
    expect(body.get('analyze')).toBe('true')
    expect((body.get('file') as File).name).toBe('pr4.csv')
    expect(swalOk.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'success',
        html: 'PR4 file queued for background processing.',
        confirmButtonText: 'View Background Process',
      }),
    )
    expect(router.currentRoute.value.path).toBe('/background-processes')
  })

  it('shows the progress while the file goes up and the server note once it is all there', async () => {
    let report: (p: number) => void = () => {}
    let finish: (v: never) => void = () => {}
    vi.mocked(analysisApi.upload).mockImplementation((_body, onProgress) => {
      report = onProgress
      return new Promise((resolve) => (finish = resolve as never))
    })
    const { w } = await mountPage()
    await w.find('#exchange_rate').setValue('3765')
    await chooseFile(w)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(w.find('[data-testid="submit"]').text()).toContain('Processing')
    expect(w.find('[data-testid="submit"]').attributes('disabled')).toBeDefined()
    expect(w.find('#exchange_rate').attributes('disabled')).toBeDefined()
    expect(w.find('#actionSelect').attributes('disabled')).toBeDefined()
    report(40)
    await flushPromises()
    expect(w.find('[data-testid="progress"]').text()).toContain('40%')
    expect(w.find('[data-testid="received"]').exists()).toBe(false)
    report(100)
    await flushPromises()
    expect(w.find('[data-testid="received"]').text()).toContain(
      'File received - processing on server, please wait...',
    )
    finish({ message: 'queued', process_id: 1, bg_url: '/background-processes' } as never)
    await flushPromises()
  })

  it.each([
    [
      409,
      { detail: 'A PR4 upload for this reporting month is already pending or processing.' },
      'A PR4 upload for this reporting month is already pending or processing.',
    ],
    [
      422,
      {
        detail: 'The given data was invalid.',
        errors: {
          file: ['The file field must be a file of type: xlsx, xls, csv, txt.'],
          exchange_rate: ['x'],
        },
      },
      'The file field must be a file of type: xlsx, xls, csv, txt. (and 1 more error)',
    ],
    [
      500,
      { detail: 'Something went wrong while uploading the file! Please contact IT for support.' },
      'Something went wrong while uploading the file! Please contact IT for support.',
    ],
    [413, undefined, 'An error occurred while uploading. Please try again.'],
  ])('shows the answer of a %i and lets the user try again', async (status, data, message) => {
    vi.mocked(analysisApi.upload).mockRejectedValue(failure(status, data))
    const { w, router } = await mountPage()
    await w.find('#exchange_rate').setValue('3765')
    await chooseFile(w)
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(swalNotification).toHaveBeenLastCalledWith('error', message)
    expect(w.find('[data-testid="submit"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid="progress"]').exists()).toBe(false)
    expect(router.currentRoute.value.path).toBe('/analysis')
  })

  it('offers the previous analysis only when there is one', async () => {
    expect((await mountPage()).w.text()).not.toContain('View Previous Analysis')
    vi.mocked(analysisApi.results).mockResolvedValue({ id: 1 } as never)
    const { w } = await mountPage()
    expect(w.text()).toContain('View Previous Analysis')
    expect(w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))).toContain('/analysis/pr4/results')
  })
})
