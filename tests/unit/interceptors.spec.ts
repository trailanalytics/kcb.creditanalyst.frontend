import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'

const fire = vi.fn()
vi.mock('@/utils/dialogs', () => ({
  swalConfirm: { fire: (...args: unknown[]) => fire(...args) },
  swalNotification: vi.fn(),
}))

import { http } from '@/api/http'
import { installErrorHandling } from '@/api/interceptors'

const failWith =
  (status: number, data: object): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('failed', String(status), config, null, {
        status,
        statusText: '',
        data,
        headers: {},
        config,
      }),
    )

describe('unexpected server errors', () => {
  const router = { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { fullPath: '/' } } }

  beforeEach(() => {
    setActivePinia(createPinia())
    fire.mockReset().mockResolvedValue({ isConfirmed: false })
    http.interceptors.response.clear()
    installErrorHandling(router as never)
  })

  it('shows the error reference for a 500', async () => {
    http.defaults.adapter = failWith(500, { status: 500, reference: 'ERR-261024-203952-EDI6' })
    await expect(http.post('/users', {})).rejects.toBeTruthy()
    expect(fire).toHaveBeenCalledTimes(1)
    expect((fire.mock.calls[0]?.[0] as { html: string }).html).toContain('ERR-261024-203952-EDI6')
  })

  it('leaves everything to the caller when the request is x-handled', async () => {
    http.defaults.adapter = failWith(500, { status: 500, reference: 'ERR-1' })
    await expect(http.post('/auth/login', {}, { headers: { 'x-handled': '1' } })).rejects.toBeTruthy()
    expect(fire).not.toHaveBeenCalled()
  })

  it('x-handled 4xx still shows the reference of a 500 but not a validation error', async () => {
    http.defaults.adapter = failWith(500, { status: 500, reference: 'ERR-2' })
    await expect(http.post('/users', {}, { headers: { 'x-handled': '4xx' } })).rejects.toBeTruthy()
    expect(fire).toHaveBeenCalledTimes(1)

    fire.mockClear()
    http.defaults.adapter = failWith(422, { status: 422, errors: { email: ['taken'] } })
    await expect(http.post('/users', {}, { headers: { 'x-handled': '4xx' } })).rejects.toBeTruthy()
    expect(fire).not.toHaveBeenCalled()
  })
})
