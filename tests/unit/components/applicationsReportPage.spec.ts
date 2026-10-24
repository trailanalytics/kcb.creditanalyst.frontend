import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() } }))
vi.mock('@/modules/application/api', () => ({ applicationsApi: { report: vi.fn() } }))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
}))
import { http } from '@/api/http'
import { applicationsApi } from '@/modules/application/api'
import ApplicationsReportPage from '@/modules/application/ApplicationsReportPage.vue'

describe('ApplicationsReportPage', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockResolvedValue({ data: [] } as never)
    vi.mocked(applicationsApi.report).mockReset()
    vi.mocked(applicationsApi.report).mockResolvedValue({ data: new Blob(['x']), headers: {} } as never)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })

  // the server reads the status by its name (All, Pending, Approved, anything else is the rejected list); the status codes
  // 2 and 0 of the list filter were sent here once and gave the rejected applications for both
  it.each([
    ['Pending', 'Pending'],
    ['Approved', 'Approved'],
    ['Rejected', 'Rejected'],
  ])('sends the name %s when it is chosen', async (label, sent) => {
    const w = mount(ApplicationsReportPage, {
      global: { plugins: [createPinia()], stubs: { RouterLink: RouterLinkStub, DateField: true } },
    })
    await flushPromises()
    const select = w.find('select')
    const option = select.findAll('option').find((o) => o.text() === label)
    await select.setValue(option?.element.value)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(applicationsApi.report).toHaveBeenCalledWith(expect.objectContaining({ status: sent }))
  })

  it('sends no status for All', async () => {
    const w = mount(ApplicationsReportPage, {
      global: { plugins: [createPinia()], stubs: { RouterLink: RouterLinkStub, DateField: true } },
    })
    await flushPromises()
    await w.find('form').trigger('submit')
    await flushPromises()
    const params = vi.mocked(applicationsApi.report).mock.calls[0]?.[0] ?? {}
    expect(params).not.toHaveProperty('status')
  })
})
