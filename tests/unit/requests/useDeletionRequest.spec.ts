import { beforeEach, describe, expect, it, vi } from 'vitest'

const fire = vi.fn()
const toastError = vi.fn()
const post = vi.fn()

vi.mock('@/utils/dialogs', () => ({
  swalDelete: { fire: (...a: unknown[]) => fire(...a) },
  toast: { error: (...a: unknown[]) => toastError(...a) },
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
}))
vi.mock('@/api/http', () => ({
  http: { post: (...a: unknown[]) => post(...a) },
  messageOf: (e: { detail?: string } | undefined, fallback: string) => e?.detail ?? fallback,
  problemOf: (e: { errors?: Record<string, string[]> } | undefined) => e ?? null,
}))

import {
  deletionErrorMessage,
  promptReason,
  submitDeletionRequest,
} from '@/modules/requests/useDeletionRequest'

describe('promptReason', () => {
  beforeEach(() => {
    fire.mockReset()
    toastError.mockReset()
  })

  it('returns the trimmed reason', async () => {
    fire.mockResolvedValueOnce({ isConfirmed: true, value: '  duplicate record  ' })
    expect(await promptReason('Delete', 'Sure?', 'Why...')).toBe('duplicate record')
    expect(fire).toHaveBeenCalledTimes(1)
    expect(fire.mock.calls[0]?.[0]).toMatchObject({
      title: 'Delete',
      text: 'Sure?',
      inputPlaceholder: 'Why...',
      input: 'textarea',
    })
  })

  it('returns null when cancelled', async () => {
    fire.mockResolvedValueOnce({ isConfirmed: false, isDismissed: true })
    expect(await promptReason('t', 'x', 'p')).toBeNull()
  })

  it('shows the message and asks again while the reason is blank', async () => {
    fire
      .mockResolvedValueOnce({ isConfirmed: true, value: '' })
      .mockResolvedValueOnce({ isConfirmed: true, value: '   ' })
      .mockResolvedValueOnce({ isConfirmed: true, value: 'wrong customer' })
    expect(await promptReason('t', 'x', 'p', 'A reason is required')).toBe('wrong customer')
    expect(fire).toHaveBeenCalledTimes(3)
    expect(toastError).toHaveBeenCalledTimes(2)
    expect(toastError).toHaveBeenCalledWith('A reason is required')
  })

  it('stops asking once the user cancels the second prompt', async () => {
    fire.mockResolvedValueOnce({ isConfirmed: true, value: '' }).mockResolvedValueOnce({ isConfirmed: false })
    expect(await promptReason('t', 'x', 'p')).toBeNull()
    expect(fire).toHaveBeenCalledTimes(2)
  })
})

describe('submitDeletionRequest', () => {
  it('posts the payload and returns the body', async () => {
    post.mockResolvedValueOnce({ data: { message: 'ok', id: 5 } })
    const payload = { record_id: 7, table_name: 'collaterals', comment: 'gone' }
    expect(await submitDeletionRequest(payload)).toEqual({ message: 'ok', id: 5 })
    expect(post).toHaveBeenCalledWith('/deletion-requests', payload)
  })
})

describe('deletionErrorMessage', () => {
  it('prefers the first field message of a 422', () => {
    const e = {
      detail: 'The given data was invalid.',
      errors: { comment: ['A reason is required'], table_name: ['x'] },
    }
    expect(deletionErrorMessage(e)).toBe('A reason is required')
  })
  it('falls back to the detail, then to the text given', () => {
    expect(
      deletionErrorMessage({ detail: 'A request to delete this record is already waiting for approval.' }),
    ).toBe('A request to delete this record is already waiting for approval.')
    expect(deletionErrorMessage(undefined)).toBe('Failed to submit deletion request. Please try again.')
  })
})
