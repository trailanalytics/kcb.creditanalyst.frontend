import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', async (orig) => ({
  ...(await orig<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}))
vi.mock('@/api/http', () => ({
  messageOf: (e: { response?: { data?: { detail?: string } } } | undefined, f: string) =>
    e?.response?.data?.detail ?? f,
}))
vi.mock('@/utils/dialogs', () => ({
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  swalDelete: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/modules/cbsqueries/api', () => ({
  cbsApi: {
    version: vi.fn(),
    submit: vi.fn(),
    revise: vi.fn(),
    activate: vi.fn(),
    promoteSample: vi.fn(),
    removeSample: vi.fn(),
  },
}))
import { cbsApi } from '@/modules/cbsqueries/api'
import VersionPage from '@/modules/cbsqueries/pages/VersionPage.vue'
import { toVersionDetail } from '@/modules/cbsqueries/normalize'
import { swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { versionJson } from './fixtures'
import { mountPage } from './mounting'

async function open(json: Record<string, unknown>, permissions = ['Manage CBS Queries']) {
  vi.mocked(cbsApi.version).mockResolvedValue(toVersionDetail(json))
  const w = mountPage(VersionPage, permissions, { id: '12' })
  await flushPromises()
  return w
}
const ids = (w: Awaited<ReturnType<typeof open>>) =>
  w.findAll('[data-testid="actions"] [data-testid]').map((b) => b.attributes('data-testid'))
const none = { canEdit: false, canSubmit: false, canReview: false, canActivate: false }

describe('VersionPage', () => {
  beforeEach(() => {
    push.mockReset()
    for (const fn of Object.values(cbsApi)) vi.mocked(fn).mockReset()
    vi.mocked(cbsApi.submit).mockResolvedValue(toVersionDetail(versionJson()))
    vi.mocked(cbsApi.revise).mockResolvedValue(toVersionDetail(versionJson({ id: 13, versionNo: 4 })))
    vi.mocked(cbsApi.activate).mockResolvedValue(toVersionDetail(versionJson()))
    vi.mocked(cbsApi.promoteSample).mockResolvedValue({})
    vi.mocked(cbsApi.removeSample).mockResolvedValue({})
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalConfirm.fire).mockClear()
    vi.mocked(swalDelete.fire).mockClear()
  })

  it('shows the status, facts, validation, reviews and the audit trail', async () => {
    const w = await open(
      versionJson({
        status: 'CHANGES_RECOMMENDED',
        ...none,
        submittedBy: 'Dan',
        submittedAt: '2026-10-21T09:00:00Z',
        latestValidation: { passed: true, runAt: '2026-10-21T09:00:00Z', findings: [] },
        reviews: [
          {
            outcome: 'CHANGES_RECOMMENDED',
            comment: 'fix',
            reviewer: 'Amy',
            createdAt: '2026-10-22T09:00:00Z',
            recommendations: [{ id: 1, text: 'Alias', appliedInVersionId: null }],
          },
        ],
        events: [
          { id: 1, event: 'SUBMITTED', actor: 'Dan', detail: null, createdAt: '2026-10-21T09:00:00Z' },
          {
            id: 2,
            event: 'REVIEWED',
            actor: 'Amy',
            detail: 'CHANGES_RECOMMENDED',
            createdAt: '2026-10-22T09:00:00Z',
          },
        ],
      }),
    )
    expect(w.get('[data-testid="status-banner"]').text()).toContain('Changes recommended')
    expect(w.get('[data-testid="facts"]').text()).toContain('version #2')
    expect(w.get('[data-testid="stored-passed"]').text()).toBe('Passed')
    expect(w.get('[data-testid="validation-history"]').text()).toContain('submitted by Dan')
    expect(w.get('[data-testid="reviews-card"]').text()).toContain('Alias')
    expect(w.get('[data-testid="audit"]').findAll('[data-testid="event"]')).toHaveLength(2)
  })

  it('offers edit and submit from the flags', async () => {
    const w = await open(versionJson({ ...none, canEdit: true, canSubmit: true }))
    expect(ids(w)).toEqual(['edit', 'submit'])
  })

  it('offers only review to the analyst when the flag is set', async () => {
    const w = await open(versionJson({ status: 'VALIDATED', ...none, canReview: true }), [
      'Review CBS Queries',
    ])
    expect(ids(w)).toEqual(['review'])
  })

  it('offers revise after recommended changes, activate when approved, and the sample actions for an active version', async () => {
    expect(ids(await open(versionJson({ status: 'CHANGES_RECOMMENDED', ...none })))).toEqual(['revise'])
    expect(ids(await open(versionJson({ status: 'APPROVED', ...none, canActivate: true })))).toEqual([
      'activate',
    ])
    expect(ids(await open(versionJson({ status: 'ACTIVE', ...none })))).toEqual(['promote'])
    expect(ids(await open(versionJson({ status: 'ACTIVE', isSample: true, ...none })))).toEqual([
      'remove-sample',
    ])
  })

  it('shows no manage actions to a user who may only review', async () => {
    const w = await open(versionJson({ status: 'ACTIVE', ...none }), ['Review CBS Queries'])
    expect(w.find('[data-testid="actions"]').exists()).toBe(false)
  })

  it('confirms, calls the API and reloads', async () => {
    const w = await open(versionJson({ status: 'APPROVED', ...none, canActivate: true }))
    await w.get('[data-testid="activate"]').trigger('click')
    await flushPromises()
    expect(swalConfirm.fire).toHaveBeenCalledOnce()
    expect(cbsApi.activate).toHaveBeenCalledWith(12)
    expect(cbsApi.version).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the confirmation is declined', async () => {
    const w = await open(versionJson({ status: 'APPROVED', ...none, canActivate: true }))
    vi.mocked(swalConfirm.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    await w.get('[data-testid="activate"]').trigger('click')
    await flushPromises()
    expect(cbsApi.activate).not.toHaveBeenCalled()
  })

  it('opens the new draft after revise', async () => {
    const w = await open(versionJson({ status: 'CHANGES_RECOMMENDED', ...none }))
    await w.get('[data-testid="revise"]').trigger('click')
    await flushPromises()
    expect(cbsApi.revise).toHaveBeenCalledWith(12)
    expect(push).toHaveBeenCalledWith('/cbs-queries/versions/13/edit')
  })

  it('uses the warning dialog to remove a sample', async () => {
    const w = await open(versionJson({ status: 'ACTIVE', isSample: true, ...none }))
    await w.get('[data-testid="remove-sample"]').trigger('click')
    await flushPromises()
    expect(swalDelete.fire).toHaveBeenCalledOnce()
    expect(cbsApi.removeSample).toHaveBeenCalledWith(12)
  })

  it('shows the 409 message from the server and reloads', async () => {
    const w = await open(versionJson({ status: 'APPROVED', ...none, canActivate: true }))
    vi.mocked(cbsApi.activate).mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { detail: 'No longer passes validation.' } },
      }),
    )
    await w.get('[data-testid="activate"]').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'No longer passes validation.')
    expect(cbsApi.version).toHaveBeenCalledTimes(2)
  })

  it('does not show a second dialog for a 5xx the interceptor already answered', async () => {
    const w = await open(versionJson({ status: 'APPROVED', ...none, canActivate: true }))
    vi.mocked(cbsApi.activate).mockRejectedValue(
      Object.assign(new Error('500'), { isAxiosError: true, response: { status: 500, data: {} } }),
    )
    await w.get('[data-testid="activate"]').trigger('click')
    await flushPromises()
    expect(swalNotification).not.toHaveBeenCalled()
  })

  it('says when the version is not found', async () => {
    vi.mocked(cbsApi.version).mockRejectedValue(
      Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404, data: {} } }),
    )
    const w = mountPage(VersionPage, ['Manage CBS Queries'], { id: '99' })
    await flushPromises()
    expect(w.get('[data-testid="load-error"]').text()).toContain('not found')
  })
})
