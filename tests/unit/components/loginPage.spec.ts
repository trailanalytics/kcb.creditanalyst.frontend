import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/utils/dialogs', () => ({ swalNotification: vi.fn(), toast: {} }))
const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { redirect: '/users' } }),
  useRouter: () => ({ replace }),
}))
import axios from 'axios'
import { http } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import LoginPage from '@/pages/LoginPage.vue'

const axiosError = (status: number, data: unknown) =>
  Object.assign(new axios.AxiosError('failed'), { isAxiosError: true, response: { status, data } })

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(http.post).mockReset()
    vi.mocked(swalNotification).mockReset()
    replace.mockReset()
  })

  async function submit(email: string, password: string) {
    const w = mount(LoginPage)
    await w.find('input[name=email]').setValue(email)
    await w.find('input[name=password]').setValue(password)
    await w.find('form').trigger('submit')
    await flushPromises()
    return w
  }

  it('signs in and goes where the user was heading', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { id: 1, permissions: [] } })
    await submit('a@kcb.test', 'pw')
    expect(http.post).toHaveBeenCalledWith('/auth/login', { email: 'a@kcb.test', password: 'pw' })
    expect(replace).toHaveBeenCalledWith('/users')
  })

  it('shows field errors from a 422 under the fields', async () => {
    vi.mocked(http.post).mockRejectedValue(
      axiosError(422, {
        errors: { email: ['The email field is required.'], password: ['The password field is required.'] },
      }),
    )
    const w = await submit('', '')
    expect(w.text()).toContain('The email field is required.')
    expect(w.text()).toContain('The password field is required.')
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows the server message for wrong credentials', async () => {
    vi.mocked(http.post).mockRejectedValue(axiosError(401, { detail: 'Invalid email address or password!' }))
    await submit('a@kcb.test', 'bad')
    expect(swalNotification).toHaveBeenCalledWith('error', 'Invalid email address or password!')
  })
})
