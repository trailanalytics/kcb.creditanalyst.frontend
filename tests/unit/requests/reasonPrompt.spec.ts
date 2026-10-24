import { afterEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'

vi.mock('@/api/http', () => ({ http: { post: vi.fn() } }))

import { http } from '@/api/http'
import { promptReason, submitDeletionRequest } from '@/modules/requests/useDeletionRequest'

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
})) as unknown as typeof window.matchMedia
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

const open = () =>
  promptReason({
    text: 'You are about to submit a request to delete this Branch! Proceed?',
    placeholder: 'Type your reason for deleting this record here...',
    requiredMessage: 'The reason for your request to delete this record is required!',
  })

describe('promptReason', () => {
  afterEach(() => Swal.close())

  it('shows the text, the placeholder and the old confirm label, and resolves the trimmed reason', async () => {
    const answer = open()
    await vi.waitFor(() => expect(Swal.getInput()).toBeTruthy())
    expect(Swal.getHtmlContainer()?.textContent).toBe(
      'You are about to submit a request to delete this Branch! Proceed?',
    )
    expect(Swal.getInput()?.getAttribute('placeholder')).toBe(
      'Type your reason for deleting this record here...',
    )
    expect(Swal.getConfirmButton()?.textContent).toBe('Yes, Proceed!')
    Swal.getInput()!.value = '  Closed branch  '
    Swal.clickConfirm()
    await expect(answer).resolves.toBe('Closed branch')
  })

  it('keeps the box open with the required message while the reason is empty', async () => {
    const answer = open()
    await vi.waitFor(() => expect(Swal.getInput()).toBeTruthy())
    Swal.getInput()!.value = '   '
    Swal.clickConfirm()
    await vi.waitFor(() =>
      expect(Swal.getValidationMessage()?.textContent).toBe(
        'The reason for your request to delete this record is required!',
      ),
    )
    Swal.clickCancel()
    await expect(answer).resolves.toBeNull()
  })
})

describe('submitDeletionRequest', () => {
  it('posts the body and returns the server message and id', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { message: 'Deletion request submitted.', id: 9 } })
    const body = { record_id: 3, table_name: 'bank_branches', comment: 'Closed' }
    await expect(submitDeletionRequest(body)).resolves.toEqual({
      message: 'Deletion request submitted.',
      id: 9,
    })
    expect(http.post).toHaveBeenCalledWith('/deletion-requests', body, { headers: { 'x-handled': '1' } })
  })
})
