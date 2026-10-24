import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { AxiosError } from 'axios'

vi.mock('@/modules/reports/api', () => ({
  outputFilesApi: { list: vi.fn(), download: vi.fn(), extract: vi.fn(), convertExcel: vi.fn() },
}))
vi.mock('@/modules/loans/download', async (orig) => ({
  ...(await orig<typeof import('@/modules/loans/download')>()),
  saveBlob: vi.fn(),
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
import OutputFilesPage from '@/modules/reports/OutputFilesPage.vue'
import OutputFilesTable from '@/modules/reports/components/OutputFilesTable.vue'
import { outputFilesApi } from '@/modules/reports/api'
import { saveBlob } from '@/modules/loans/download'
import { swalNotification } from '@/utils/dialogs'
import type { OutputFileRow } from '@/modules/reports/types'

const row = (id: number, extra: Partial<OutputFileRow> = {}): OutputFileRow => ({
  id,
  rule_name: `CBA_${id}`,
  records_count: 12345,
  report_type: 'CBA',
  submission_date: '20260930',
  version: '8.0',
  time_remaining: '12 days',
  expired: false,
  download_name: `CBA_${id}.xlsx`,
  created_at: '2026-10-20 10:00:00',
  ...extra,
})

describe('OutputFilesTable', () => {
  it('shows the time left on active rows and disables the download of expired ones', () => {
    const w = mount(OutputFilesTable, {
      props: { rows: [row(1), row(2, { expired: true, time_remaining: 'expired' })] },
    })
    const [active, expired] = w.findAll('[data-testid="output-row"]')
    expect(active?.text()).toContain('CBA_1')
    expect(active?.text()).toContain('( 12 days left )')
    expect(active?.text()).toContain('12,345')
    expect(active?.text()).toContain('8.0')
    expect(active?.text()).toContain('20260930')
    expect(active?.find('button').exists()).toBe(true)
    expect(expired?.text()).not.toContain('left')
    expect(expired?.find('button').exists()).toBe(false)
    expect(expired?.find('[aria-disabled="true"]').exists()).toBe(true)
    expect(expired?.find('[data-testid="expired"]').classes()).toContain('text-danger')
  })

  it('asks for the download of the row clicked', async () => {
    const w = mount(OutputFilesTable, { props: { rows: [row(7)] } })
    await w.get('button').trigger('click')
    expect(w.emitted('download')?.[0]?.[0]).toMatchObject({ id: 7 })
  })
})

describe('OutputFilesPage', () => {
  beforeEach(() => {
    vi.mocked(outputFilesApi.list).mockReset().mockResolvedValue([])
    vi.mocked(outputFilesApi.download).mockReset()
    vi.mocked(outputFilesApi.extract).mockReset()
    vi.mocked(outputFilesApi.convertExcel).mockReset()
    vi.mocked(saveBlob).mockReset()
    vi.mocked(swalNotification).mockReset()
  })

  const mountPage = async () => {
    const w = mount(OutputFilesPage, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await flushPromises()
    return w
  }
  const choose = async (w: Awaited<ReturnType<typeof mountPage>>, selector: string, file: File) => {
    const input = w.get(selector).element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await w.get(selector).trigger('change')
  }

  it('shows no table and no message when nothing was kept, only the two cards', async () => {
    const w = await mountPage()
    expect(w.find('table').exists()).toBe(false)
    expect(w.text()).toContain('Upload CSV Output File')
    expect(w.text()).toContain('Convert Excel To CRB CSV File')
  })

  it('lists the kept files newest first as the server sent them', async () => {
    vi.mocked(outputFilesApi.list).mockResolvedValue([row(2), row(1)])
    const w = await mountPage()
    expect(w.findAll('[data-testid="output-row"]').map((r) => r.text().slice(0, 5))).toEqual([
      'CBA_2',
      'CBA_1',
    ])
  })

  it('asks for what is missing before anything is sent', async () => {
    const w = await mountPage()
    await w.get('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith('error', 'Please select the report type.')
    await w.get('select[name="report_type"]').setValue('cba')
    await w.get('form').trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith('error', 'Please choose the output file.')
    await choose(w, '#output_file', new File(['x'], 'feedback.csv'))
    await w.get('#rule_name').setValue('../etc')
    await w.get('form').trigger('submit')
    expect(String(vi.mocked(swalNotification).mock.calls.at(-1)?.[1])).toMatch(/letters, digits/)
    expect(outputFilesApi.extract).not.toHaveBeenCalled()
  })

  it('extracts the affected records, saves the workbook and refreshes the list', async () => {
    vi.mocked(outputFilesApi.extract).mockResolvedValue({
      data: new Blob(['x']),
      headers: { 'content-disposition': 'attachment; filename="CBA_399.xlsx"' },
    } as never)
    const w = await mountPage()
    await w.get('select[name="report_type"]').setValue('cba')
    await choose(w, '#output_file', new File(['x'], 'feedback.csv'))
    await w.get('#rule_name').setValue('CBA_399')
    vi.mocked(outputFilesApi.list).mockResolvedValue([row(9, { rule_name: 'CBA_399' })])
    await w.get('form').trigger('submit')
    await flushPromises()
    const form = vi.mocked(outputFilesApi.extract).mock.calls[0]?.[0] as FormData
    expect(form.get('report_type')).toBe('cba')
    expect(form.get('rule_name')).toBe('CBA_399')
    expect((form.get('output_file') as File).name).toBe('feedback.csv')
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'CBA_399.xlsx')
    expect(w.findAll('[data-testid="output-row"]')).toHaveLength(1)
  })

  it('shows the server message when the extract fails', async () => {
    vi.mocked(outputFilesApi.extract).mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 422,
        data: new Blob([JSON.stringify({ detail: 'No sheet for report type XYZ.' })]),
      } as never),
    )
    const w = await mountPage()
    await w.get('select[name="report_type"]').setValue('cba')
    await choose(w, '#output_file', new File(['x'], 'feedback.csv'))
    await w.get('#rule_name').setValue('CBA_1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(swalNotification).toHaveBeenLastCalledWith('error', 'No sheet for report type XYZ.')
  })

  it('converts an Excel file and saves the csv', async () => {
    vi.mocked(outputFilesApi.convertExcel).mockResolvedValue({
      data: new Blob(['x']),
      headers: { 'content-disposition': 'attachment; filename="1761300000.csv"' },
    } as never)
    const w = await mountPage()
    const forms = w.findAll('form')
    await forms[1]?.trigger('submit')
    expect(swalNotification).toHaveBeenLastCalledWith('error', 'Please choose the Excel file.')
    await choose(w, '#excel_file', new File(['x'], 'data.xlsx'))
    await forms[1]?.trigger('submit')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), '1761300000.csv')
  })
})
