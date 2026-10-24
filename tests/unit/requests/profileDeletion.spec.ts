import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'

vi.mock('@/api/http', () => ({
  http: {},
  messageOf: (e: { message?: string }, fallback: string) => e?.message ?? fallback,
  problemOf: () => null,
}))
vi.mock('@/modules/customer/api', () => ({ profilesApi: { existence: vi.fn() } }))
vi.mock('@/modules/requests/useDeletionRequest', () => ({
  submitDeletionRequest: vi.fn(),
  promptReason: vi.fn(),
}))

import { profilesApi } from '@/modules/customer/api'
import {
  choicesHtml,
  confirmationHtml,
  deletionBody,
  requestProfileDeletion,
} from '@/modules/customer/profileDeletion'
import type { Existence } from '@/modules/customer/types'
import { submitDeletionRequest } from '@/modules/requests/useDeletionRequest'

// jsdom has no matchMedia, which SweetAlert asks for when it opens
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
})) as unknown as typeof window.matchMedia

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

const both: Existence = {
  customer_id: 5,
  client_number: '1000005',
  full_name: 'Okello <b>James</b>',
  classification: 0,
  individual_name: 'Okello James',
  non_individual_name: 'Okello Traders Ltd',
  has_individual: true,
  has_non_individual: true,
  individual_id: 51,
  non_individual_id: 52,
}
const onlyIndividual: Existence = {
  ...both,
  has_non_individual: false,
  non_individual_id: null,
  non_individual_name: null,
}

describe('profile deletion dialogs (text and payload)', () => {
  it('offers three choices with the kept record spelled out when the customer has both records', () => {
    const html = choicesHtml(both)
    expect(html).toContain('This customer has both an Individual and a Non-Individual record.')
    expect(html).toContain('Remove <b>Individual</b> record (Okello James)')
    expect(html).toContain('Keeps the Non-Individual record (Okello Traders Ltd)')
    expect(html).toContain('Remove <b>Non-Individual</b> record (Okello Traders Ltd)')
    expect(html).toContain('Keeps the Individual record (Okello James)')
    expect(html).toContain('(removes all records)')
    expect(html.match(/type="radio"/g)).toHaveLength(3)
    expect(html).not.toContain(' checked')
    // the badge marks the current classification (0 = individual) once
    expect(html.match(/current classification/g)).toHaveLength(1)
    expect(html.indexOf('current classification')).toBeLessThan(html.indexOf('Non-Individual</b> record'))
  })

  it('escapes the names', () => {
    expect(choicesHtml(both)).toContain('Okello &#60;b&#62;James&#60;/b&#62;')
    expect(choicesHtml(both)).not.toContain('Okello <b>James</b>')
  })

  it('has a single pre-checked "entire profile" choice when only one record exists', () => {
    const html = choicesHtml(onlyIndividual)
    expect(html.match(/type="radio"/g)).toHaveLength(1)
    expect(html).toContain('value="full" class="mr-2" checked')
    expect(html).not.toContain('both an Individual')
  })

  it('says what the customer becomes after each removal', () => {
    expect(confirmationHtml('individual', both)).toContain(
      'the customer will be classified as <b>Non-Individual</b>',
    )
    expect(confirmationHtml('non_individual', both)).toContain(
      'the customer will be classified as <b>Individual</b>',
    )
    expect(confirmationHtml('full', both)).toContain('permanently delete the entire profile')
    expect(confirmationHtml('full', { ...both, full_name: ' ' })).toContain('<b>this customer</b>')
  })

  it('sends the record, table and scope of each choice', () => {
    expect(deletionBody('individual', both, 'x')).toEqual({
      record_id: 51,
      table_name: 'customer_individuals',
      deletion_scope: null,
      comment: 'x',
    })
    expect(deletionBody('non_individual', both, 'x')).toEqual({
      record_id: 52,
      table_name: 'customer_non_individuals',
      deletion_scope: null,
      comment: 'x',
    })
    expect(deletionBody('full', both, 'x')).toEqual({
      record_id: 5,
      table_name: 'customers',
      deletion_scope: 'customer_full',
      comment: 'x',
    })
  })
})

/** Waits for the dialog with this title (the loaders have none). */
const dialog = (title: string) =>
  vi.waitFor(() => {
    if (Swal.getTitle()?.textContent !== title) throw new Error(`waiting for ${title}`)
  })
const radio = (value: string) =>
  document.querySelector<HTMLInputElement>(`input[name="deleteType"][value="${value}"]`)!

describe('requestProfileDeletion (real dialogs)', () => {
  beforeEach(() => {
    vi.mocked(profilesApi.existence).mockReset()
    vi.mocked(submitDeletionRequest).mockReset()
  })
  afterEach(() => Swal.close())

  it('removes only the individual record: choose, give a reason, submit', async () => {
    vi.mocked(profilesApi.existence).mockResolvedValue(both)
    vi.mocked(submitDeletionRequest).mockResolvedValue({ message: 'Deletion request submitted.', id: 3 })
    const done = requestProfileDeletion(5)

    await dialog('Delete Customer Profile')
    expect(profilesApi.existence).toHaveBeenCalledWith(5)
    // nothing selected: stays open with the validation message
    Swal.clickConfirm()
    await vi.waitFor(() =>
      expect(Swal.getValidationMessage()?.textContent).toBe('Please select a deletion option to proceed.'),
    )
    expect(Swal.getTitle()?.textContent).toBe('Delete Customer Profile')
    radio('individual').click()
    Swal.clickConfirm()

    await dialog('Confirm Deletion Request')
    expect(Swal.getHtmlContainer()?.textContent).toContain(
      'Once approved, the customer will be classified as Non-Individual.',
    )
    expect(Swal.getInput()?.getAttribute('placeholder')).toBe(
      'State your reason for this deletion request...',
    )
    // an empty (blank) reason is refused
    Swal.getInput()!.value = '   '
    Swal.clickConfirm()
    await vi.waitFor(() =>
      expect(Swal.getValidationMessage()?.textContent).toBe('A reason for the deletion request is required.'),
    )
    expect(submitDeletionRequest).not.toHaveBeenCalled()
    Swal.getInput()!.value = ' Wrong record captured '
    Swal.clickConfirm()

    await vi.waitFor(() => expect(Swal.getPopup()?.textContent).toContain('Deletion request submitted.'))
    expect(submitDeletionRequest).toHaveBeenCalledWith({
      record_id: 51,
      table_name: 'customer_individuals',
      deletion_scope: null,
      comment: 'Wrong record captured',
    })
    Swal.clickConfirm()
    await expect(done).resolves.toBe(true)
  })

  it('requests the whole profile with the customer_full scope', async () => {
    vi.mocked(profilesApi.existence).mockResolvedValue(onlyIndividual)
    vi.mocked(submitDeletionRequest).mockResolvedValue({ message: 'Done.', id: 4 })
    const done = requestProfileDeletion(5)
    await dialog('Delete Customer Profile')
    expect(radio('full').checked).toBe(true)
    Swal.clickConfirm()
    await dialog('Confirm Deletion Request')
    expect(Swal.getHtmlContainer()?.textContent).toContain('permanently delete the entire profile')
    Swal.getInput()!.value = 'Duplicate customer'
    Swal.clickConfirm()
    await vi.waitFor(() => expect(Swal.getPopup()?.textContent).toContain('Done.'))
    expect(submitDeletionRequest).toHaveBeenCalledWith({
      record_id: 5,
      table_name: 'customers',
      deletion_scope: 'customer_full',
      comment: 'Duplicate customer',
    })
    Swal.clickConfirm()
    await expect(done).resolves.toBe(true)
  })

  it('files nothing when the first dialog is cancelled', async () => {
    vi.mocked(profilesApi.existence).mockResolvedValue(both)
    const done = requestProfileDeletion(5)
    await dialog('Delete Customer Profile')
    Swal.clickCancel()
    await expect(done).resolves.toBe(false)
    expect(submitDeletionRequest).not.toHaveBeenCalled()
  })

  it('tells the user when the customer data cannot be loaded', async () => {
    vi.mocked(profilesApi.existence).mockRejectedValue(new Error('boom'))
    const done = requestProfileDeletion(5)
    await dialog('Error')
    expect(Swal.getHtmlContainer()?.textContent).toBe('Could not load customer data. Please try again.')
    Swal.clickConfirm()
    await expect(done).resolves.toBe(false)
  })

  it('shows the refusal of the server in an error dialog', async () => {
    vi.mocked(profilesApi.existence).mockResolvedValue(onlyIndividual)
    vi.mocked(submitDeletionRequest).mockRejectedValue(
      new Error('A deletion request is already open for this record.'),
    )
    const done = requestProfileDeletion(5)
    await dialog('Delete Customer Profile')
    Swal.clickConfirm()
    await dialog('Confirm Deletion Request')
    Swal.getInput()!.value = 'Because'
    Swal.clickConfirm()
    await dialog('Error')
    expect(Swal.getHtmlContainer()?.textContent).toBe('A deletion request is already open for this record.')
    Swal.clickConfirm()
    await expect(done).resolves.toBe(false)
  })
})
