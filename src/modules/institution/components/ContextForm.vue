<script setup lang="ts">
import { ref, watch } from 'vue'
import { provideProfile } from '@/modules/customer/profileContext'
import type { ProfileModel } from '@/modules/customer/types'

/**
 * Gives plain forms (institution, branch, the fraud and PIS headers) the same field components the profile form uses:
 * ProfileRow, ProfileInput and the address block read and write the model through this context.
 */
const props = withDefaults(defineProps<{ invalid?: string[]; embedded?: boolean }>(), {
  invalid: () => [],
  embedded: false,
})
const form = defineModel<ProfileModel>({ required: true })

const invalidFields = ref<string[]>([])
watch(
  () => props.invalid,
  (v) => (invalidFields.value = [...v]),
  { immediate: true },
)

provideProfile({
  get form() {
    return form.value
  },
  invalid: invalidFields,
  id: 'ctx',
  get embedded() {
    return props.embedded
  },
  set(name, value) {
    form.value[name] = value
    invalidFields.value = invalidFields.value.filter((f) => f !== name)
  },
})
</script>

<template>
  <div><slot /></div>
</template>
