import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  onBeforeRouteLeave: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/api/http', () => ({
  http: { get: vi.fn() },
  messageOf: (e: { response?: { data?: { detail?: string } } } | undefined, f: string) =>
    e?.response?.data?.detail ?? f,
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  swalDelete: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/modules/cbsqueries/api', () => ({
  cbsApi: { version: vi.fn(), validate: vi.fn(), save: vi.fn(), submit: vi.fn() },
}))
import { cbsApi } from '@/modules/cbsqueries/api'
import EditorPage from '@/modules/cbsqueries/pages/EditorPage.vue'
import { toOutcome, toVersionDetail } from '@/modules/cbsqueries/normalize'
import { swalConfirm, swalNotification, toast } from '@/utils/dialogs'
import { versionJson } from './fixtures'
import { mountPage } from './mounting'

const SQL = 'SELECT A.CUS_ID, A.NAME AS CUS_NAME\nFROM CUSTOMER A'
const missingAlias = (sql: string) => {
  const at = sql.indexOf('A.CUS_ID') + 'A.CUS_ID'.length
  return sql.includes('A.CUS_ID AS')
    ? toOutcome({ passed: true, errorCount: 0, warningCount: 0, findings: [] })
    : toOutcome({
        passed: false,
        errorCount: 1,
        warningCount: 0,
        findings: [
          {
            ordinal: 1,
            severity: 'ERROR',
            code: 'MISSING_ALIAS',
            columnPosition: 1,
            foundText: 'A.CUS_ID',
            expectedAlias: 'CUS_ID',
            suggestedOffset: at,
            message: 'Add AS CUS_ID',
          },
        ],
      })
}

const mountEditor = async (json = versionJson({ sql: SQL })) => {
  vi.mocked(cbsApi.version).mockResolvedValue(toVersionDetail(json))
  const w = mountPage(EditorPage, ['Manage CBS Queries'], { id: '12' })
  await flushPromises()
  return w
}

describe('EditorPage', () => {
  beforeEach(() => {
    vi.mocked(cbsApi.version).mockReset()
    vi.mocked(cbsApi.validate)
      .mockReset()
      .mockImplementation(async ({ sql }) => missingAlias(sql))
    vi.mocked(cbsApi.save).mockReset()
    vi.mocked(cbsApi.submit).mockReset()
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalConfirm.fire).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  it('loads the version, checks the text at once and shows the findings with the module columns beside it', async () => {
    const w = await mountEditor()
    expect((w.get('[data-testid="sql"]').element as HTMLTextAreaElement).value).toBe(SQL)
    expect(cbsApi.validate).toHaveBeenCalledWith({ module: 'extract-customers', sql: SQL })
    expect(w.get('[data-testid="finding-1"]').text()).toContain('Add AS CUS_ID')
    expect(w.get('[data-testid="column-CUS_ID"]').attributes('data-state')).toBe('missing')
    expect(w.get('[data-testid="column-CUS_NAME"]').attributes('data-state')).toBe('ok')
    expect(w.get('[data-testid="status-banner"]').text()).toContain('Draft')
  })

  it('applies a suggestion at its offset, checks again and ticks the column', async () => {
    const w = await mountEditor()
    await w.get('[data-testid="finding-1"] [data-testid="apply"]').trigger('click')
    await flushPromises()
    expect((w.get('[data-testid="sql"]').element as HTMLTextAreaElement).value).toBe(
      'SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME\nFROM CUSTOMER A',
    )
    expect(w.get('[data-testid="live-passed"]').text()).toBe('Passes')
    expect(w.get('[data-testid="column-CUS_ID"]').attributes('data-state')).toBe('ok')
  })

  it('saves the draft with the text and the note and reloads', async () => {
    const w = await mountEditor()
    expect(w.get('[data-testid="save"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="note"]').setValue('fixed')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(cbsApi.save).toHaveBeenCalledWith(12, { sql: SQL, note: 'fixed' })
    expect(cbsApi.version).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Draft saved.')
  })

  it('asks before submitting a text with errors, and does nothing when declined', async () => {
    const w = await mountEditor()
    vi.mocked(swalConfirm.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    await w.get('[data-testid="submit"]').trigger('click')
    await flushPromises()
    expect(swalConfirm.fire).toHaveBeenCalledOnce()
    expect(cbsApi.submit).not.toHaveBeenCalled()
  })

  it('saves unsaved text first, submits and shows the stored result', async () => {
    const w = await mountEditor(
      versionJson({ sql: 'SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A' }),
    )
    await w
      .get('[data-testid="sql"]')
      .setValue('SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A WHERE 1 = ?')
    vi.mocked(cbsApi.submit).mockResolvedValue(toVersionDetail(versionJson()))
    vi.mocked(cbsApi.version).mockResolvedValue(
      toVersionDetail(
        versionJson({
          status: 'VALIDATED',
          canEdit: false,
          canSubmit: false,
          latestValidation: { passed: true, runAt: '2026-10-24T09:00:00Z', findings: [] },
        }),
      ),
    )
    await w.get('[data-testid="submit"]').trigger('click')
    await flushPromises()
    expect(cbsApi.save).toHaveBeenCalledOnce()
    expect(cbsApi.submit).toHaveBeenCalledWith(12)
    expect(w.get('[data-testid="status-banner"]').text()).toContain('Validated')
    expect(w.get('[data-testid="stored-passed"]').text()).toBe('Passed')
    expect(w.find('[data-testid="submit"]').exists()).toBe(false)
    expect(w.get('[data-testid="sql"]').attributes('readonly')).toBeDefined()
  })

  it('follows the flags: no buttons and a read only box when the caller cannot edit or submit', async () => {
    const w = await mountEditor(versionJson({ status: 'ACTIVE', canEdit: false, canSubmit: false }))
    expect(w.find('[data-testid="save"]').exists()).toBe(false)
    expect(w.find('[data-testid="submit"]').exists()).toBe(false)
    expect(w.get('[data-testid="sql"]').attributes('readonly')).toBeDefined()
    expect(cbsApi.validate).not.toHaveBeenCalled()
  })

  it('shows the server message when saving is refused', async () => {
    const w = await mountEditor()
    await w.get('[data-testid="note"]').setValue('x')
    const refused = Object.assign(new Error('409'), {
      isAxiosError: true,
      response: { status: 409, data: { detail: 'Not a draft any more.' } },
    })
    vi.mocked(cbsApi.save).mockRejectedValue(refused)
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'Not a draft any more.')
  })

  it('shows a message when the version cannot be loaded', async () => {
    vi.mocked(cbsApi.version).mockRejectedValue(new Error('boom'))
    const w = mountPage(EditorPage, ['Manage CBS Queries'], { id: '12' })
    await flushPromises()
    expect(w.get('[data-testid="load-error"]').text()).toContain('could not be loaded')
  })
})
