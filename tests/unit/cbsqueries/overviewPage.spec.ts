import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, RouterLinkStub } from '@vue/test-utils'

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}))
vi.mock('@/api/http', () => ({
  messageOf: (e: { response?: { data?: { detail?: string } } } | undefined, f: string) =>
    e?.response?.data?.detail ?? f,
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/modules/cbsqueries/api', () => ({
  cbsApi: {
    coreSystems: vi.fn(),
    modules: vi.fn(),
    versions: vi.fn(),
    createDraft: vi.fn(),
    samples: vi.fn(),
    version: vi.fn(),
  },
}))
import { cbsApi } from '@/modules/cbsqueries/api'
import OverviewPage from '@/modules/cbsqueries/pages/OverviewPage.vue'
import SamplesPage from '@/modules/cbsqueries/pages/SamplesPage.vue'
import {
  toCoreSystem,
  toModuleSummary,
  toVersionDetail,
  toVersionSummary,
} from '@/modules/cbsqueries/normalize'
import { swalConfirm } from '@/utils/dialogs'
import { COLUMNS, versionJson } from './fixtures'
import { mountPage } from './mounting'

const core = [
  toCoreSystem({ code: 'T24', name: 'T24', configured: false }),
  toCoreSystem({ code: 'FINACLE', name: 'Finacle', configured: true }),
]
const moduleJson = (code: string, systems: unknown[]) => ({
  code,
  name: code.toUpperCase(),
  bindCount: 0,
  columns: COLUMNS,
  coreSystems: systems,
})
const modules = [
  toModuleSummary(
    moduleJson('extract-customers', [
      {
        coreSystem: 'T24',
        activeVersion: { id: 5, versionNo: 2, activatedAt: '2026-10-01T10:00:00Z', activatedBy: 'Dan' },
        sampleCount: 1,
      },
      { coreSystem: 'FINACLE', activeVersion: null, sampleCount: 0 },
    ]),
  ),
  toModuleSummary(
    moduleJson('extract-loans', [
      {
        coreSystem: 'FINACLE',
        activeVersion: { id: 8, versionNo: 1, activatedAt: null, activatedBy: null },
        sampleCount: 0,
      },
    ]),
  ),
]

describe('OverviewPage', () => {
  beforeEach(() => {
    push.mockReset()
    for (const fn of Object.values(cbsApi)) vi.mocked(fn).mockReset()
    vi.mocked(cbsApi.coreSystems).mockResolvedValue(core)
    vi.mocked(cbsApi.modules).mockResolvedValue(modules)
    vi.mocked(cbsApi.versions).mockResolvedValue([])
    vi.mocked(swalConfirm.fire).mockClear()
  })

  it('preselects the configured core system and loads its versions once', async () => {
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    expect((w.get('[data-testid="core-system"]').element as HTMLSelectElement).value).toBe('FINACLE')
    expect(cbsApi.versions).toHaveBeenCalledTimes(1)
    expect(cbsApi.versions).toHaveBeenCalledWith({ coreSystem: 'FINACLE', size: 200 })
  })

  it('shows the active version, who and when, the validation badge and the sample count per module', async () => {
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    expect(w.find('[data-testid="module-extract-customers"] [data-testid="no-active"]').exists()).toBe(true)
    expect(w.get('[data-testid="module-extract-customers"] [data-testid="validation"]').text()).toBe(
      'No active query',
    )
    expect(w.get('[data-testid="module-extract-loans"] [data-testid="active-no"]').text()).toBe('Version 1')
    expect(w.get('[data-testid="module-extract-loans"] [data-testid="validation"]').text()).toBe('Validated')

    await w.get('[data-testid="core-system"]').setValue('T24')
    await flushPromises()
    const customers = w.get('[data-testid="module-extract-customers"]')
    expect(customers.get('[data-testid="active-no"]').text()).toBe('Version 2')
    expect(customers.get('[data-testid="active-by"]').text()).toContain('by Dan, 1 Oct 2026')
    expect(customers.get('[data-testid="samples"]').text()).toBe('1')
    expect(w.get('[data-testid="not-configured"]').text()).toContain('does not run T24')
  })

  it('links to the latest version in progress', async () => {
    vi.mocked(cbsApi.versions).mockResolvedValue([
      toVersionSummary({
        id: 21,
        coreSystem: 'FINACLE',
        module: 'extract-customers',
        versionNo: 2,
        status: 'VALIDATED',
      }),
      toVersionSummary({
        id: 20,
        coreSystem: 'FINACLE',
        module: 'extract-customers',
        versionNo: 1,
        status: 'DRAFT',
      }),
    ])
    const w = mountPage(OverviewPage, ['Review CBS Queries'])
    await flushPromises()
    const link = w
      .findAllComponents(RouterLinkStub)
      .find((c) => c.attributes('data-testid') === 'open-progress')
    expect(link?.text()).toContain('v2')
    expect(link?.props('to')).toBe('/cbs-queries/versions/21')
  })

  it('hides Start draft from a user without Manage CBS Queries', async () => {
    const w = mountPage(OverviewPage, ['Review CBS Queries'])
    await flushPromises()
    expect(w.find('[data-testid="start-draft"]').exists()).toBe(false)
  })

  it('starts a draft from the active version and opens the editor', async () => {
    vi.mocked(cbsApi.createDraft).mockResolvedValue(toVersionDetail(versionJson({ id: 40, versionNo: 2 })))
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    await w.get('[data-testid="module-extract-loans"] [data-testid="start-draft"]').trigger('click')
    await flushPromises()
    expect(cbsApi.createDraft).toHaveBeenCalledWith({
      coreSystem: 'FINACLE',
      module: 'extract-loans',
      fromVersionId: 8,
    })
    expect(push).toHaveBeenCalledWith('/cbs-queries/versions/40/edit')
  })

  it('starts a blank draft when there is no active version', async () => {
    vi.mocked(cbsApi.createDraft).mockResolvedValue(toVersionDetail(versionJson({ id: 41 })))
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    await w.get('[data-testid="module-extract-customers"] [data-testid="start-draft"]').trigger('click')
    await flushPromises()
    expect(cbsApi.createDraft).toHaveBeenCalledWith({ coreSystem: 'FINACLE', module: 'extract-customers' })
  })

  it('asks first when another version is still in progress', async () => {
    vi.mocked(cbsApi.versions).mockResolvedValue([
      toVersionSummary({
        id: 21,
        coreSystem: 'FINACLE',
        module: 'extract-customers',
        versionNo: 2,
        status: 'DRAFT',
      }),
    ])
    vi.mocked(swalConfirm.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    await w.get('[data-testid="module-extract-customers"] [data-testid="start-draft"]').trigger('click')
    await flushPromises()
    expect(swalConfirm.fire).toHaveBeenCalledOnce()
    expect(cbsApi.createDraft).not.toHaveBeenCalled()
  })

  it('shows a message when the modules cannot be loaded', async () => {
    vi.mocked(cbsApi.modules).mockRejectedValue(new Error('down'))
    const w = mountPage(OverviewPage, ['Manage CBS Queries'])
    await flushPromises()
    expect(w.get('[data-testid="load-error"]').text()).toContain('could not be loaded')
  })
})

describe('SamplesPage', () => {
  beforeEach(() => {
    push.mockReset()
    for (const fn of Object.values(cbsApi)) vi.mocked(fn).mockReset()
    vi.mocked(cbsApi.coreSystems).mockResolvedValue(core)
    vi.mocked(cbsApi.modules).mockResolvedValue(modules)
    vi.mocked(cbsApi.samples).mockResolvedValue([])
  })

  it('says "No validated sample yet" for a core system without samples', async () => {
    const w = mountPage(SamplesPage, ['Manage CBS Queries'])
    await flushPromises()
    expect(cbsApi.samples).toHaveBeenCalledTimes(1)
    expect(cbsApi.samples).toHaveBeenCalledWith({ coreSystem: 'FINACLE' })
    expect(w.get('[data-testid="no-samples"]').text()).toContain('No validated sample yet')
  })

  it('groups samples by module and can show the SQL and use one as a draft for the target core system', async () => {
    vi.mocked(cbsApi.samples).mockResolvedValue([
      toVersionSummary({
        id: 2,
        coreSystem: 'T24',
        module: 'extract-loans',
        versionNo: 1,
        status: 'ACTIVE',
        isSample: true,
      }),
    ])
    vi.mocked(cbsApi.version).mockResolvedValue(
      toVersionDetail(versionJson({ id: 2, sql: 'SELECT 1 AS CUS_ID FROM DUAL' })),
    )
    vi.mocked(cbsApi.createDraft).mockResolvedValue(toVersionDetail(versionJson({ id: 50 })))
    const w = mountPage(SamplesPage, ['Manage CBS Queries'])
    await flushPromises()
    expect(w.find('[data-testid="no-samples"]').exists()).toBe(false)
    expect(w.get('[data-testid="group-extract-loans"] [data-testid="sample-2"]').text()).toContain(
      'T24 version 1',
    )

    await w.get('[data-testid="view-sql"]').trigger('click')
    await flushPromises()
    expect((w.get('[data-testid="sample-sql"] textarea').element as HTMLTextAreaElement).value).toBe(
      'SELECT 1 AS CUS_ID FROM DUAL',
    )

    await w.get('[data-testid="use-as-draft"]').trigger('click')
    await flushPromises()
    expect(cbsApi.createDraft).toHaveBeenCalledWith({
      coreSystem: 'FINACLE',
      module: 'extract-loans',
      fromVersionId: 2,
    })
    expect(push).toHaveBeenCalledWith('/cbs-queries/versions/50/edit')
  })

  it('does not offer Use as draft to a reviewer', async () => {
    vi.mocked(cbsApi.samples).mockResolvedValue([
      toVersionSummary({
        id: 2,
        coreSystem: 'T24',
        module: 'extract-loans',
        versionNo: 1,
        status: 'ACTIVE',
        isSample: true,
      }),
    ])
    const w = mountPage(SamplesPage, ['Review CBS Queries'])
    await flushPromises()
    expect(w.find('[data-testid="use-as-draft"]').exists()).toBe(false)
  })
})
