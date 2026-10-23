import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/utils/dialogs', () => ({ swalNotification: vi.fn(), toast: {} }))
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import { emptyProfile } from '@/modules/customer/profileModel'
import { swalNotification } from '@/utils/dialogs'
import type { ProfileModel } from '@/modules/customer/types'

async function mountForm(classification = '0', props: Record<string, unknown> = {}) {
  setActivePinia(createPinia())
  const model = ref<ProfileModel>({ ...emptyProfile(classification), clientNumber: '1000001' })
  const wrapper = mount(ProfileForm, {
    props: {
      modelValue: model.value,
      'onUpdate:modelValue': (v: ProfileModel) => (model.value = v),
      ...props,
    },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  return { wrapper, model }
}

describe('ProfileForm', () => {
  beforeEach(() => vi.mocked(swalNotification).mockReset())

  it('shows the individual sections for classification 0 and the company ones for 1', async () => {
    const individual = await mountForm('0')
    expect(individual.wrapper.find('[data-section="individual"]').exists()).toBe(true)
    expect(individual.wrapper.find('[data-section="non-individual"]').exists()).toBe(false)
    const company = await mountForm('1')
    expect(company.wrapper.find('[data-section="non-individual"]').exists()).toBe(true)
    expect(company.wrapper.find('[name="GSCAFB_Surname"]').exists()).toBe(false)
  })

  it('writes typed values into the model and mirrors the primary address into the alternative one', async () => {
    const { wrapper, model } = await mountForm()
    await wrapper.find('[name="PCI_District"]').setValue('Wakiso')
    expect(model.value.PCI_District).toBe('Wakiso')
    expect(model.value.SCI_District).toBe('Wakiso')
    // each phone mirrors into its own field (the old form copied the mobile number into the primary phone)
    await wrapper.find('[name="PCI_MobileNumber"]').setValue('0772')
    expect(model.value.SCI_MobileNumber).toBe('0772')
    expect(model.value.SCI_PrimaryTelephoneNumber).toBe('')
  })

  it('does not touch the primary address when the alternative one is typed', async () => {
    const { wrapper, model } = await mountForm()
    await wrapper.find('[name="SCI_Village"]').setValue('Banda')
    expect(model.value.SCI_Village).toBe('Banda')
    expect(model.value.PCI_Village).toBe('')
  })

  it('outlines the fields it is told are invalid and clears one when it is changed', async () => {
    const { wrapper } = await mountForm('0', { invalid: ['PCI_Village', 'branchCode'] })
    expect(wrapper.find('[name="PCI_Village"]').classes()).toContain('is-invalid')
    await wrapper.find('[name="PCI_Village"]').setValue('Banda')
    expect(wrapper.find('[name="PCI_Village"]').classes()).not.toContain('is-invalid')
    expect(wrapper.find('[name="branchCode"]').classes()).toContain('is-invalid')
  })

  it('tells the parent the classification changed', async () => {
    const { wrapper } = await mountForm('0')
    await wrapper.find('[name="classificationCode"]').setValue('1')
    expect(wrapper.emitted('classificationChange')?.[0]).toEqual(['1'])
  })

  it('refuses client number edits after three clicks', async () => {
    const { wrapper } = await mountForm()
    const input = wrapper.find('input[placeholder="Client Number"]')
    await input.trigger('click')
    await input.trigger('click')
    expect(swalNotification).not.toHaveBeenCalled()
    await input.trigger('click')
    expect(swalNotification).toHaveBeenCalledWith('info', 'Editing client numbers is currently disabled!')
  })

  it('leaves out the section heading on the CAP forms and the VAT field on the joint one', async () => {
    const withHeading = await mountForm('1')
    expect(withHeading.wrapper.text()).toContain('Company Information')
    const cap = await mountForm('1', { newCap: true, joint: true })
    expect(cap.wrapper.text()).not.toContain('Company Information')
    expect(cap.wrapper.find('[name="II_ValueAddedTaxNumber"]').exists()).toBe(false)
  })
})
