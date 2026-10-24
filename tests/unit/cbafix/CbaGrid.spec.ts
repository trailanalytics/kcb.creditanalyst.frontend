import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CbaGrid from '@/modules/cbafix/components/CbaGrid.vue'
import { toRow } from '@/modules/cbafix/gridModel'
import type { CbaColumn } from '@/modules/cbafix/types'

const columns: CbaColumn[] = [
  { key: 'Borrowers_Client_Number', label: 'Borrowers Client Number', readonly: true, numeric: false },
  { key: 'Credit_Account_Reference', label: 'Credit Account Reference', readonly: true, numeric: false },
  { key: 'Credit_Amount', label: 'Credit Amount', readonly: false, numeric: true },
  {
    key: 'Credit_Account_Closure_Date',
    label: 'Credit Account Closure Date',
    readonly: false,
    numeric: false,
  },
  { key: 'Credit_Account_Status', label: 'Credit Account Status', readonly: false, numeric: false },
]

function mountGrid(extra: Record<string, unknown> = {}) {
  const rows = [
    toRow({ id: 1, values: ['C1', 'REF1', '5000', null, '4'] }),
    toRow({ id: 2, values: ['C2', 'REF2', '100', '20260930', '1'] }),
  ]
  return mount(CbaGrid, {
    props: { columns, rows, visible: columns.map(() => true), rule: '', ...extra },
    attachTo: document.body,
  })
}

describe('CbaGrid', () => {
  it('has one header per shown column and an input per cell, NULL as empty', () => {
    const w = mountGrid({ visible: [true, true, true, false, true] })
    expect(w.findAll('th').map((h) => h.text())).toEqual([
      'Borrowers Client Number',
      'Credit Account Reference',
      'Credit Amount',
      'Credit Account Status',
    ])
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.findAll('tbody tr')[0]!.findAll('input')).toHaveLength(4)
    w.unmount()
  })

  it('shows hidden columns away without moving the others: edits report the index in the full row', async () => {
    const w = mountGrid({ visible: [true, true, false, true, true] })
    const input = w.find('[data-cell="0:Credit_Account_Closure_Date"]')
    await input.setValue('20260930')
    expect(w.emitted('edit')![0]).toEqual([0, 3, '20260930'])
    w.unmount()
  })

  it('keeps the two key columns read-only', () => {
    const w = mountGrid()
    expect(w.find('[data-cell="0:Credit_Account_Reference"]').attributes('readonly')).toBeDefined()
    expect(w.find('[data-cell="0:Borrowers_Client_Number"]').attributes('readonly')).toBeDefined()
    expect(w.find('[data-cell="0:Credit_Amount"]').attributes('readonly')).toBeUndefined()
    w.unmount()
  })

  it('marks an edited cell with the green border and an unfinished number cell in red', async () => {
    const w = mountGrid()
    const rows = w.props('rows')
    rows[0]!.values[3] = '20260930'
    rows[0]!.values[2] = 'abc'
    await w.setProps({ rows: [...rows] })
    const classes = (cell: string) => w.find(`[data-cell="${cell}"]`).element.parentElement!.className
    expect(classes('0:Credit_Account_Closure_Date')).toContain('border-b-[#14A44D]')
    expect(classes('0:Credit_Amount')).toContain('ring-danger')
    expect(classes('1:Credit_Amount')).not.toContain('border-b-[#14A44D]')
    w.unmount()
  })

  it('highlights the cells of the rule whose records are shown', () => {
    const w = mountGrid({ rule: 'CBA_106' })
    const classes = (cell: string) => w.find(`[data-cell="${cell}"]`).element.parentElement!.className
    expect(classes('0:Credit_Account_Closure_Date')).toContain('bg-red-100')
    expect(classes('0:Credit_Account_Status')).toContain('bg-amber-50')
    expect(classes('0:Credit_Amount')).toContain('bg-slate-50')
    w.unmount()
  })

  it('offers Hide Row and Remove From CBA on a first column cell, for the first row too', async () => {
    const w = mountGrid()
    await w
      .find('[data-cell="0:Borrowers_Client_Number"]')
      .trigger('contextmenu', { clientX: 10, clientY: 10 })
    const items = w.findAll('[role="menuitem"]').map((i) => i.text())
    expect(items).toEqual(['Hide Row', 'Remove From CBA', 'Cancel'])
    await w.findAll('[role="menuitem"]')[1]!.trigger('click')
    expect(w.emitted('removeRow')![0]).toEqual([0])
    expect(w.find('[role="menu"]').exists()).toBe(false)
    w.unmount()
  })

  it('offers Clear Content and Restore Content on other cells and closes on Cancel', async () => {
    const w = mountGrid()
    await w.find('[data-cell="1:Credit_Amount"]').trigger('contextmenu')
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual([
      'Clear Content',
      'Restore Content',
      'Cancel',
    ])
    await w.findAll('[role="menuitem"]')[0]!.trigger('click')
    expect(w.emitted('clear')![0]).toEqual([1, 2])
    await w.find('[data-cell="1:Credit_Amount"]').trigger('contextmenu')
    await w.findAll('[role="menuitem"]')[2]!.trigger('click')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(w.emitted('restore')).toBeUndefined()
    w.unmount()
  })

  it('closes the menu on a click anywhere else', async () => {
    const w = mountGrid()
    await w.find('[data-cell="1:Credit_Amount"]').trigger('contextmenu')
    expect(w.find('[role="menu"]').exists()).toBe(true)
    document.body.click()
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(false)
    w.unmount()
  })
})
