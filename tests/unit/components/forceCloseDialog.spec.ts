import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/api/http', () => ({ messageOf: (_e: unknown, f: string) => f, problemOf: () => null, http: {} }))
vi.mock('@/utils/dialogs', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  swalNotification: vi.fn(),
  swalConfirm: { fire: vi.fn(async () => ({ isConfirmed: true })) },
}))
vi.mock('@/modules/loans/api', () => ({ loansApi: { forceClose: vi.fn() } }))
import ForceCloseDialog from '@/modules/loans/components/ForceCloseDialog.vue'
import { loansApi } from '@/modules/loans/api'
import { swalNotification } from '@/utils/dialogs'

async function mountOpen() {
  const w = mount(ForceCloseDialog, {
    props: { open: true },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

const rowsOf = () => Array.from(document.querySelectorAll('[data-testid="force-close-row"]'))
const click = async (label: RegExp) => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => label.test(x.textContent ?? ''))
  b?.click()
  await flushPromises()
}
const fill = async (row: Element, label: string, value: string) => {
  const input = row.querySelector<HTMLInputElement>(`[aria-label^="${label}"]`)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('ForceCloseDialog', () => {
  beforeEach(() => {
    vi.mocked(loansApi.forceClose).mockReset()
    vi.mocked(swalNotification).mockReset()
    document.body.innerHTML = ''
  })

  it('starts with one row, adds rows and removes any row but the first', async () => {
    const w = await mountOpen()
    expect(rowsOf()).toHaveLength(1)
    expect(rowsOf()[0]!.querySelector('[aria-label="Remove row 1"]')).toBeNull()
    await click(/Add More/)
    await click(/Add More/)
    expect(rowsOf()).toHaveLength(3)
    await fill(rowsOf()[1]!, 'Contract code', 'AA2')
    await fill(rowsOf()[2]!, 'Contract code', 'AA3')
    rowsOf()[1]!.querySelector<HTMLButtonElement>('[aria-label="Remove row 2"]')!.click()
    await flushPromises()
    expect(rowsOf()).toHaveLength(2)
    expect(rowsOf()[1]!.querySelector<HTMLInputElement>('[aria-label^="Contract code"]')!.value).toBe('AA3')
    w.unmount()
  })

  it('sends only the rows that have something in them, each row with its own values', async () => {
    vi.mocked(loansApi.forceClose).mockResolvedValue({
      message: 'Loan Accounts Force Closed Successfully!',
      closed: 2,
    })
    const w = await mountOpen()
    await click(/Add More/)
    await click(/Add More/)
    const [r1, , r3] = rowsOf()
    await fill(r1!, 'Contract code', 'AA1')
    await fill(r1!, 'Closure date', '2026-09-01')
    await fill(r1!, 'Closure reason', '2')
    await fill(r1!, 'Last payment date', '2026-08-01')
    await fill(r1!, 'Last payment amount', '1500')
    await fill(r3!, 'Contract code', 'AA3')
    await fill(r3!, 'Closure date', '2026-09-03')
    await fill(r3!, 'Closure reason', '4')
    await fill(r3!, 'Last payment date', '2026-08-03')
    await fill(r3!, 'Last payment amount', '300')
    await click(/Save changes/)
    expect(loansApi.forceClose).toHaveBeenCalledWith([
      {
        contractCode: 'AA1',
        creditAccountClosureDate: '2026-09-01',
        creditAccountClosureReason: '2',
        lastPaymentDate: '2026-08-01',
        lastPaymentAmount: '1500',
      },
      {
        contractCode: 'AA3',
        creditAccountClosureDate: '2026-09-03',
        creditAccountClosureReason: '4',
        lastPaymentDate: '2026-08-03',
        lastPaymentAmount: '300',
      },
    ])
    expect(w.emitted('saved')).toHaveLength(1)
    w.unmount()
  })

  it('does not call the server when every row is empty', async () => {
    const w = await mountOpen()
    await click(/Save changes/)
    expect(loansApi.forceClose).not.toHaveBeenCalled()
    expect(swalNotification).toHaveBeenCalledWith('error', 'Enter at least one loan account to force close.')
    w.unmount()
  })
})
