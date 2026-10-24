import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', () => ({
  http: { get: vi.fn() },
  messageOf: (e: { detail?: string } | undefined, f: string) => e?.detail ?? f,
  problemOf: () => null,
}))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  swalDelete: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
vi.mock('@/modules/requests/api', () => ({
  requestApi: { record: vi.fn(), approve: vi.fn(), cancel: vi.fn() },
}))
import { http } from '@/api/http'
import { requestApi } from '@/modules/requests/api'
import RequestsPage from '@/modules/requests/RequestsPage.vue'
import { swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { useAuthStore } from '@/stores/auth'

const row = (id: number, status = 0, by = 7) => ({
  id,
  request_id: `DDR-20261024-C${id}`,
  record_id: id,
  table_name: 'collaterals',
  deletion_scope: null,
  request_status: status,
  request_comment: 'duplicate entry',
  requested_by: by,
  requested_by_name: 'Mia Maker',
  requested_at: '2026-10-24T08:30:00',
  actioned_by: status ? 9 : null,
  actioned_by_name: status ? 'Cy Checker' : null,
  actioned_at: status ? '2026-10-25T09:00:00' : null,
  approval_comment: status ? 'N/A' : '',
  record_label: `KCB/CMC/${id} - Ann Borrower`,
})
const page = (data: unknown[]) => ({
  data: { data, current_page: 1, last_page: 1, per_page: 20, total: data.length, from: 1, to: data.length },
})

function mountPage(
  permissions = ['View Deletion Requests', 'Approve Deletion Requests', 'Cancel Deletion Requests'],
  id = 1,
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id,
    firstname: null,
    lastname: null,
    name: 'x',
    email: 'x@y.test',
    role: 'crb-officer',
    branchId: null,
    permissions,
  }
  return mount(RequestsPage, { global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } } })
}

describe('RequestsPage', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(requestApi.record).mockReset()
    vi.mocked(requestApi.approve).mockReset()
    vi.mocked(requestApi.cancel).mockReset()
    vi.mocked(swalNotification).mockReset()
    vi.mocked(swalDelete.fire).mockClear()
    vi.mocked(swalConfirm.fire).mockClear()
  })

  it('asks for the pending requests first and shows the row as the Laravel page did', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    const w = mountPage()
    await flushPromises()
    expect(vi.mocked(http.get).mock.calls[0]?.[1]?.params).toMatchObject({ status: 0 })
    const text = w.find('[data-testid="request-1"]').text()
    expect(text).toContain('DDR-20261024-C1')
    expect(text).toContain('Pending Approval')
    expect(text).toContain('Mia Maker')
    expect(text).toContain('24, Oct 2026')
    expect(text).toContain('duplicate entry')
    expect(text).toContain('Accept & Delete')
    expect(text).toContain('Decline & Maintain')
  })

  it('shows the outcome of decided requests instead of buttons', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1, 1), row(2, 2)]) as never)
    const w = mountPage()
    await flushPromises()
    expect(w.find('[data-testid="request-1"]').text()).toContain('Request Approved')
    expect(w.find('[data-testid="request-1"]').text()).toContain('(Record was deleted)')
    expect(w.find('[data-testid="request-2"]').text()).toContain('Request Canceled')
    expect(w.find('[data-testid="request-2"]').text()).toContain('(Record retained)')
    expect(w.find('[data-testid="approve"]').exists()).toBe(false)
  })

  it('reloads from page one with the chosen status', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    const w = mountPage()
    await flushPromises()
    await w.find('[data-testid="status"]').setValue('2')
    await flushPromises()
    const last = vi.mocked(http.get).mock.calls.at(-1)?.[1]?.params
    expect(last).toMatchObject({ status: 2, page: 1 })
  })

  it('keeps the buttons for what the user may do and hides them on the own request', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1), row(2, 0, 1)]) as never)
    const w = mountPage(['View Deletion Requests', 'Approve Deletion Requests'])
    await flushPromises()
    expect(w.find('[data-testid="request-1"] [data-testid="approve"]').exists()).toBe(true)
    expect(w.find('[data-testid="request-1"] [data-testid="cancel"]').exists()).toBe(false)
    expect(w.find('[data-testid="request-2"] [data-testid="approve"]').exists()).toBe(false)
    expect(w.find('[data-testid="request-2"] [data-testid="waiting"]').exists()).toBe(true)
  })

  it('approves after the warning, shows the message and reloads', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    vi.mocked(requestApi.approve).mockResolvedValue({ message: 'Request Approved Successfully!' })
    const w = mountPage()
    await flushPromises()
    await w.find('[data-testid="approve"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalDelete.fire).mock.calls[0]?.[0]).toMatchObject({
      html: 'This Request will be approved and the corresponding record will be deleted and removed from listing! Proceed?',
      confirmButtonText: 'Yes, Proceed!',
    })
    expect(requestApi.approve).toHaveBeenCalledWith(1)
    expect(swalNotification).toHaveBeenCalledWith('success', 'Request Approved Successfully!')
    expect(vi.mocked(http.get).mock.calls.length).toBe(2)
  })

  it('declines with the other warning and does nothing when the dialog is dismissed', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    vi.mocked(requestApi.cancel).mockResolvedValue({ message: 'Request Canceled Successfully!' })
    const w = mountPage()
    await flushPromises()
    vi.mocked(swalConfirm.fire).mockResolvedValueOnce({ isConfirmed: false } as never)
    await w.find('[data-testid="cancel"]').trigger('click')
    await flushPromises()
    expect(requestApi.cancel).not.toHaveBeenCalled()

    await w.find('[data-testid="cancel"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(swalConfirm.fire).mock.calls[1]?.[0]).toMatchObject({
      html: 'This Request will be canceled and the corresponding record will not be deleted! Proceed?',
    })
    expect(requestApi.cancel).toHaveBeenCalledWith(1)
  })

  it('shows the refusal and does not announce success', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    vi.mocked(requestApi.approve).mockRejectedValue({ detail: 'You are not allowed to action this request!' })
    const w = mountPage()
    await flushPromises()
    await w.find('[data-testid="approve"]').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'You are not allowed to action this request!')
    expect(swalNotification).not.toHaveBeenCalledWith('success', expect.anything())
  })

  it('says so when the record is gone', async () => {
    vi.mocked(http.get).mockResolvedValue(page([row(1)]) as never)
    vi.mocked(requestApi.record).mockResolvedValue({
      id: 1,
      request_id: 'x',
      table_name: 'collaterals',
      record_id: 1,
      record_label: null,
      record: null,
    })
    const w = mountPage()
    await flushPromises()
    await w.find('[data-testid="view"]').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', 'Oops, record not found!')
  })

  it('shows a load failure and an empty list', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('down'))
    const w = mountPage()
    await flushPromises()
    expect(w.find('[data-testid="load-error"]').text()).toBe(
      'Failed to load requests. Please refresh and try again.',
    )
  })
})
