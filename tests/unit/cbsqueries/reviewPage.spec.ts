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
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('@/modules/cbsqueries/api', () => ({ cbsApi: { version: vi.fn(), review: vi.fn() } }))
import { cbsApi } from '@/modules/cbsqueries/api'
import ReviewPage from '@/modules/cbsqueries/pages/ReviewPage.vue'
import { toVersionDetail } from '@/modules/cbsqueries/normalize'
import { swalConfirm, swalNotification } from '@/utils/dialogs'
import { versionJson } from './fixtures'
import { mountPage } from './mounting'

const validated = (extra: Record<string, unknown> = {}) =>
  versionJson({
    status: 'VALIDATED',
    canEdit: false,
    canSubmit: false,
    canReview: true,
    latestValidation: {
      passed: true,
      runAt: '2026-10-21T09:00:00Z',
      findings: [
        {
          ordinal: 1,
          severity: 'WARNING',
          code: 'EXTRA_COLUMN',
          columnPosition: 3,
          foundText: 'X',
          message: 'Not read',
        },
      ],
    },
    reviews: [
      {
        outcome: 'CHANGES_RECOMMENDED',
        comment: 'first round',
        reviewer: 'Amy',
        createdAt: '2026-10-19T09:00:00Z',
        recommendations: [{ id: 1, text: 'Alias it', appliedInVersionId: 11 }],
      },
    ],
    ...extra,
  })

async function open(json = validated()) {
  vi.mocked(cbsApi.version).mockResolvedValue(toVersionDetail(json))
  const w = mountPage(ReviewPage, ['Review CBS Queries'], { id: '12' })
  await flushPromises()
  return w
}

describe('ReviewPage', () => {
  beforeEach(() => {
    push.mockReset()
    vi.mocked(cbsApi.version).mockReset()
    vi.mocked(cbsApi.review).mockReset().mockResolvedValue({})
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalConfirm.fire).mockClear()
  })

  it('shows the SQL read only, the expected columns, the latest findings and the earlier reviews', async () => {
    const w = await open()
    expect(w.get('[data-testid="sql"]').attributes('readonly')).toBeDefined()
    expect((w.get('[data-testid="sql"]').element as HTMLTextAreaElement).value).toContain('SELECT A.ID')
    expect(w.get('[data-testid="expected-columns"]').text()).toContain('CUS_NAME')
    expect(w.get('[data-testid="latest-findings"]').text()).toContain('Not read')
    expect(w.get('[data-testid="history"]').text()).toContain('first round')
    expect(w.get('[data-testid="applied-in"]').text()).toContain('version #11')
  })

  it('refuses a form without an outcome, and changes without a recommendation', async () => {
    const w = await open()
    await w.get('[data-testid="send-review"]').trigger('submit')
    expect(w.get('[data-testid="form-error"]').text()).toContain('Choose an outcome')
    await w.get('[data-testid="outcome-changes"]').setValue()
    await w.get('[data-testid="recommendation-input"]').setValue('   ')
    await w.get('[data-testid="send-review"]').trigger('submit')
    expect(w.get('[data-testid="form-error"]').text()).toContain('at least one recommendation')
    expect(cbsApi.review).not.toHaveBeenCalled()
  })

  it('sends the outcome, the comment and the non-blank recommendation lines', async () => {
    const w = await open()
    await w.get('[data-testid="outcome-changes"]').setValue()
    await w.get('[data-testid="comment"]').setValue('  needs work ')
    await w.get('[data-testid="recommendation-input"]').setValue('Alias A.ID')
    await w.get('[data-testid="add-recommendation"]').trigger('click')
    await w.get('[data-testid="add-recommendation"]').trigger('click')
    const inputs = w.findAll('[data-testid="recommendation-input"]')
    await inputs[2]?.setValue(' Remove EXTRA ')
    await w.get('[data-testid="send-review"]').trigger('submit')
    await flushPromises()
    expect(cbsApi.review).toHaveBeenCalledWith(12, {
      outcome: 'CHANGES_RECOMMENDED',
      comment: 'needs work',
      recommendations: ['Alias A.ID', 'Remove EXTRA'],
    })
    expect(push).toHaveBeenCalledWith('/cbs-queries/versions/12')
  })

  it('confirms an approval and sends no recommendations', async () => {
    const w = await open()
    await w.get('[data-testid="outcome-approved"]').setValue()
    await w.get('[data-testid="send-review"]').trigger('submit')
    await flushPromises()
    expect(swalConfirm.fire).toHaveBeenCalledOnce()
    expect(cbsApi.review).toHaveBeenCalledWith(12, { outcome: 'APPROVED', comment: '', recommendations: [] })
  })

  it('does not send an approval that was not confirmed', async () => {
    const w = await open()
    vi.mocked(swalConfirm.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    await w.get('[data-testid="outcome-approved"]').setValue()
    await w.get('[data-testid="send-review"]').trigger('submit')
    await flushPromises()
    expect(cbsApi.review).not.toHaveBeenCalled()
  })

  it('shows the server message for a refused review and stays on the page', async () => {
    const w = await open()
    vi.mocked(cbsApi.review).mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { detail: 'SELF_REVIEW: you submitted this.' } },
      }),
    )
    await w.get('[data-testid="outcome-changes"]').setValue()
    await w.get('[data-testid="recommendation-input"]').setValue('x')
    await w.get('[data-testid="send-review"]').trigger('submit')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'SELF_REVIEW: you submitted this.')
    expect(push).not.toHaveBeenCalled()
  })

  it('has no form when the server says the caller cannot review', async () => {
    const w = await open(validated({ canReview: false }))
    expect(w.find('[data-testid="review-form"]').exists()).toBe(false)
    expect(w.find('[data-testid="cannot-review"]').exists()).toBe(true)
  })
})
