import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import axios from 'axios'

vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
vi.mock('@/modules/t24/api', () => ({
  t24Api: {
    commands: vi.fn(),
    runCommand: vi.fn(),
    database: vi.fn(),
    saveCredentials: vi.fn(),
    forexRates: vi.fn(),
    updateForexRate: vi.fn(),
    addForexRate: vi.fn(),
    importedRecords: vi.fn(),
  },
}))
import CommandsTab from '@/modules/t24/components/CommandsTab.vue'
import ForexTab from '@/modules/t24/components/ForexTab.vue'
import ImportsTab from '@/modules/t24/components/ImportsTab.vue'
import PasswordTab from '@/modules/t24/components/PasswordTab.vue'
import { t24Api } from '@/modules/t24/api'
import { swalConfirm, swalNotification } from '@/utils/dialogs'
import { useAuthStore } from '@/stores/auth'

const api = vi.mocked(t24Api)

function failure(status: number, detail: string) {
  const error = new axios.AxiosError('failed', String(status), undefined, undefined, {
    status,
    data: { detail },
  } as never)
  return error
}

function signIn(permissions: string[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    firstname: null,
    lastname: null,
    name: 'x',
    email: 'x@y.test',
    role: 'crb',
    branchId: null,
    permissions,
  }
  return pinia
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(swalConfirm.fire).mockResolvedValue({ isConfirmed: true } as never)
})

describe('CommandsTab', () => {
  const commands = [
    { name: 'customers', description: 'Extract New Customers from T24' },
    { name: 'loans', description: 'Extract New Loans from T24' },
  ]

  async function mountTab() {
    api.commands.mockResolvedValue(commands)
    const w = mount(CommandsTab, { global: { plugins: [signIn([])] } })
    await flushPromises()
    return w
  }

  it('lists the commands as "name (description)"', async () => {
    const w = await mountTab()
    const options = w.findAll('option').map((o) => o.text())
    expect(options).toEqual([
      '--- select command ---',
      'customers (Extract New Customers from T24)',
      'loans (Extract New Loans from T24)',
    ])
    expect(w.get('[data-testid=command-status]').text()).toContain('Inactive')
  })

  it('asks for a command instead of doing nothing', async () => {
    const w = await mountTab()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Select a command to run.')
    expect(swalConfirm.fire).not.toHaveBeenCalled()
  })

  it('does not run when the confirmation is declined', async () => {
    vi.mocked(swalConfirm.fire).mockResolvedValue({ isConfirmed: false } as never)
    const w = await mountTab()
    await w.get('select').setValue('loans')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(api.runCommand).not.toHaveBeenCalled()
  })

  it('shows the server message when the command is accepted (202)', async () => {
    api.runCommand.mockResolvedValue({ status: 202, message: 'Command started.', process_id: 9 })
    const w = await mountTab()
    await w.get('select').setValue('loans')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(api.runCommand).toHaveBeenCalledWith('loans')
    expect(swalNotification).toHaveBeenCalledWith('success', 'Command started.')
    expect(w.get('[data-testid=command-status]').text()).toContain('Inactive')
  })

  it.each([
    [404, 'Unknown task: loans'],
    [409, 'The task extract-loans is already running.'],
  ])('shows the reason for a %s', async (status, detail) => {
    api.runCommand.mockRejectedValue(failure(status, detail))
    const w = await mountTab()
    await w.get('select').setValue('loans')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(swalNotification).toHaveBeenCalledWith('error', detail)
  })

  it('leaves a server error to the global handler', async () => {
    api.runCommand.mockRejectedValue(failure(500, 'boom'))
    const w = await mountTab()
    await w.get('select').setValue('loans')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(swalNotification).not.toHaveBeenCalled()
  })
})

describe('PasswordTab', () => {
  const saved = {
    configured: true,
    username: 'dwh_user',
    expiry_date: '2026-11-30',
    expired: false,
    days_to_expiry: 30,
  }

  it('never fills the password and says how to keep it', async () => {
    api.database.mockResolvedValue(saved)
    const w = mount(PasswordTab, { global: { plugins: [signIn(['Update T24 Credentials'])] } })
    await flushPromises()
    const password = w.get('input[name=password]')
    expect((password.element as HTMLInputElement).value).toBe('')
    expect(password.attributes('placeholder')).toBe('Leave blank to keep the current password')
    expect((w.get('input[name=username]').element as HTMLInputElement).value).toBe('dwh_user')
    expect(w.get('[data-testid=expiry-line]').text()).toContain('30 days left')
  })

  it('is read only, with no save button, without Update T24 Credentials', async () => {
    api.database.mockResolvedValue(saved)
    const w = mount(PasswordTab, { global: { plugins: [signIn(['Sync T24'])] } })
    await flushPromises()
    expect(w.get('input[name=username]').attributes('readonly')).toBeDefined()
    expect(w.get('input[name=password]').attributes('readonly')).toBeDefined()
    expect(w.find('button[type=submit]').exists()).toBe(false)
    expect(w.text()).toContain('Update T24 Credentials permission')
  })

  it('sends a blank password when it was not typed, and shows a failed login on the password field', async () => {
    api.database.mockResolvedValue(saved)
    api.saveCredentials.mockRejectedValue(
      Object.assign(failure(422, 'x'), {
        response: {
          status: 422,
          data: {
            errors: { password: ['Failed to establish a connection using the provided credentials!'] },
          },
        },
      }),
    )
    const w = mount(PasswordTab, { global: { plugins: [signIn(['Update T24 Credentials'])] } })
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.saveCredentials).toHaveBeenCalledWith({
      username: 'dwh_user',
      password: '',
      expiry_date: '2026-11-30',
    })
    expect(w.text()).toContain('Failed to establish a connection using the provided credentials!')
  })
})

describe('ForexTab', () => {
  const rates = [
    { id: 7, currency: 'USD', ugx_equivalent: 3700, month_ending: '20260930', added_by: 'a@b.test' },
    { id: 8, currency: 'KES', ugx_equivalent: 28.5, month_ending: '20260930', added_by: 'a@b.test' },
  ]

  async function mountTab() {
    api.forexRates.mockResolvedValue(rates)
    const w = mount(ForexTab, { global: { plugins: [signIn([])] }, attachTo: document.body })
    await flushPromises()
    return w
  }

  it('shows the rate with two decimals and the date as D, MMM YYYY', async () => {
    const w = await mountTab()
    const rows = w.findAll('[data-testid=forex-row]')
    expect(rows[0]?.text()).toContain('3700.00')
    expect(rows[0]?.text()).toContain('30, Sep 2026')
    w.unmount()
  })

  it('saves an edit on Enter in the edit box', async () => {
    api.updateForexRate.mockResolvedValue({ message: 'Changes saved successfully!' })
    const w = await mountTab()
    await w.get('button[aria-label="Edit USD rate"]').trigger('click')
    const input = w.get('input[aria-label="UGX equivalent of USD"]')
    await input.setValue('3,720.5')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(api.updateForexRate).toHaveBeenCalledWith(7, '3720.5')
    expect(api.forexRates).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('cancels on Escape and ignores Enter elsewhere on the page', async () => {
    const w = await mountTab()
    await w.get('button[aria-label="Edit USD rate"]').trigger('click')
    await w.get('input[aria-label="UGX equivalent of USD"]').setValue('9')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(api.updateForexRate).not.toHaveBeenCalled()
    await w.get('input[aria-label="UGX equivalent of USD"]').trigger('keydown.esc')
    expect(w.find('input[aria-label="UGX equivalent of USD"]').exists()).toBe(false)
    expect(w.text()).toContain('3700.00')
    w.unmount()
  })

  it('shows why an invalid edit is not sent', async () => {
    const w = await mountTab()
    await w.get('button[aria-label="Edit USD rate"]').trigger('click')
    const input = w.get('input[aria-label="UGX equivalent of USD"]')
    await input.setValue('abc')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(api.updateForexRate).not.toHaveBeenCalled()
    expect(w.text()).toContain('The UGX equivalent must be a number.')
    w.unmount()
  })
})

describe('ImportsTab', () => {
  it('shows one card per date with the count and the time taken', async () => {
    api.importedRecords.mockResolvedValue({
      '2026-10-24': [
        {
          id: 1,
          imported_records: 12345,
          record_category: 'loans',
          started_at: null,
          ended_at: null,
          imported_by: null,
          time_taken: '1h 5m 3s',
        },
      ],
    })
    const w = mount(ImportsTab, { global: { plugins: [signIn([])] } })
    await flushPromises()
    expect(w.findAll('[data-testid=import-day]')).toHaveLength(1)
    expect(w.text()).toContain('24, Oct 2026')
    expect(w.text()).toContain((12345).toLocaleString())
    expect(w.text()).toContain('Time taken to complete task: 1h 5m 3s')
  })

  it('says so when nothing finished', async () => {
    api.importedRecords.mockResolvedValue({})
    const w = mount(ImportsTab, { global: { plugins: [signIn([])] } })
    await flushPromises()
    expect(w.text()).toContain('No extraction has finished')
  })
})
