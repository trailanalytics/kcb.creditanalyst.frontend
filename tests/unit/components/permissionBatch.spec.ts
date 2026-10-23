import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionBatch from '@/modules/identity/PermissionBatch.vue'
import type { PermissionGroup } from '@/modules/identity/types'

const groups: PermissionGroup[] = [
  { group: 'Admin', permissions: [{ id: 1, name: 'Manage Users', isDefault: false }] },
  {
    group: 'Profile',
    permissions: [
      { id: 8, name: 'View Profiles', isDefault: false },
      { id: 9, name: 'Search Profiles', isDefault: true },
    ],
  },
]

describe('PermissionBatch', () => {
  it('ticks and unticks a whole group', async () => {
    const w = mount(PermissionBatch, { props: { groups, modelValue: [], role: 'crb-officer' } })
    await w.find('input[aria-label="Select all Profile permissions"]').setValue(true)
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([[8, 9]])

    await w.setProps({ modelValue: [8, 9] })
    await w.find('input[aria-label="Select all Profile permissions"]').setValue(false)
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([[]])
  })

  it('marks a partly selected group as indeterminate', () => {
    const w = mount(PermissionBatch, { props: { groups, modelValue: [8], role: 'crb-officer' } })
    const box = w.find('input[aria-label="Select all Profile permissions"]').element as HTMLInputElement
    expect(box.indeterminate).toBe(true)
    expect(box.checked).toBe(false)
  })

  it('does not offer the Admin group to the crb role', () => {
    const crb = mount(PermissionBatch, { props: { groups, modelValue: [], role: 'crb' } })
    expect(crb.text()).not.toContain('Manage Users')
    const officer = mount(PermissionBatch, { props: { groups, modelValue: [], role: 'crb-officer' } })
    expect(officer.text()).toContain('Manage Users')
  })
})
