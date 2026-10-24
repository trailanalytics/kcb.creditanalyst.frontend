import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ValidationPanel from '@/modules/cbafix/components/ValidationPanel.vue'
import type { Validations } from '@/modules/cbafix/types'

const data: Validations = {
  total_accounts: 300,
  validations: {
    CBA_023: {
      name: 'CBA_023',
      desc: 'NO CURRENT BALANCE AMOUNT SUPPLIED',
      count: 3,
      percentage: 1,
      fixable: false,
    },
    CBA_106: {
      name: 'CBA_106',
      desc: 'THE CREDIT ACCOUNT CLOSURE DATE FIELD IS NULL',
      count: 30,
      percentage: 10,
      fixable: true,
    },
    CBA_282: {
      name: 'CBA_282',
      desc: 'THE CREDIT ACCOUNT ARREARS DATE FIELD IS NULL',
      count: 0,
      percentage: 0,
      fixable: true,
    },
    CBA_429: {
      name: 'CBA_429',
      desc: 'CREDIT ACCOUNT DATE IS GREATER THAN MATURITY DATE',
      count: 1,
      percentage: 0.33,
      fixable: false,
    },
  },
}

const mountPanel = (props: Record<string, unknown> = {}) =>
  mount(ValidationPanel, {
    props: { data, loading: false, failed: false, activeRule: '', busy: false, ...props },
    attachTo: document.body,
  })

const row = (w: ReturnType<typeof mountPanel>, rule: string) => w.find(`[data-rule="${rule}"]`)

describe('ValidationPanel', () => {
  it('lists every rule with its percentage, count and the size of the table', () => {
    const w = mountPanel()
    expect(w.findAll('[data-rule]')).toHaveLength(4)
    expect(row(w, 'CBA_106').text()).toContain('10% (30)')
    expect(row(w, 'CBA_106').text()).toContain('300')
    expect(row(w, 'CBA_429').text()).toContain('0.33% (1)')
    w.unmount()
  })

  it('offers Fix and View for a fixable rule with records, View only for one that needs a person, a tick for none', () => {
    const w = mountPanel()
    expect(row(w, 'CBA_106').find('[aria-label="Fix CBA_106"]').exists()).toBe(true)
    expect(row(w, 'CBA_106').find('[aria-label="Show CBA_106 records"]').exists()).toBe(true)
    expect(row(w, 'CBA_023').find('[aria-label="Fix CBA_023"]').exists()).toBe(false)
    expect(row(w, 'CBA_023').find('[aria-label="Show CBA_023 records"]').exists()).toBe(true)
    expect(row(w, 'CBA_282').find('[aria-label="no records"]').exists()).toBe(true)
    expect(row(w, 'CBA_282').find('button').exists()).toBe(false)
    w.unmount()
  })

  it('reports the rule the user wants fixed or shown', async () => {
    const w = mountPanel()
    await row(w, 'CBA_106').find('[aria-label="Fix CBA_106"]').trigger('click')
    await row(w, 'CBA_023').find('[aria-label="Show CBA_023 records"]').trigger('click')
    expect(w.emitted('fix')![0]).toEqual(['CBA_106'])
    expect(w.emitted('view')![0]).toEqual(['CBA_023'])
    w.unmount()
  })

  it('fixes everything only when some fixable rule has records, and not while busy', async () => {
    const w = mountPanel()
    const button = () => w.findAll('button').find((b) => b.text() === 'Fix all')!
    expect(button().attributes('disabled')).toBeUndefined()
    await button().trigger('click')
    expect(w.emitted('fixAll')).toHaveLength(1)
    await w.setProps({ busy: true })
    expect(button().attributes('disabled')).toBeDefined()
    await w.setProps({
      busy: false,
      data: {
        ...data,
        validations: { CBA_023: data.validations.CBA_023!, CBA_282: data.validations.CBA_282! },
      },
    })
    expect(button().attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('marks the rule being shown and lets the user clear it', async () => {
    const w = mountPanel({ activeRule: 'CBA_106' })
    expect(row(w, 'CBA_106').classes()).toContain('bg-amber-50')
    expect(w.text()).toContain('Showing CBA_106')
    await w.find('[aria-label="Show all records again"]').trigger('click')
    expect(w.emitted('clearRule')).toHaveLength(1)
    w.unmount()
  })

  it('says when it is loading or failed instead of showing a table', async () => {
    const w = mountPanel({ data: null, loading: true })
    expect(w.text()).toContain('loading...')
    await w.setProps({ loading: false, failed: true })
    expect(w.text()).toContain('Failed to load validation rules. Please try again.')
    expect(w.find('table').exists()).toBe(false)
    w.unmount()
  })

  it('opens the full table with the description of every rule', async () => {
    const w = mountPanel()
    await w.find('[aria-label="Expand validations"]').trigger('click')
    const table = document.body.querySelector('[data-testid="validation-table"]')!
    expect(table.textContent).toContain('THE CREDIT ACCOUNT CLOSURE DATE FIELD IS NULL')
    expect(document.body.textContent).toContain('CBA Validation')
    w.unmount()
  })
})
