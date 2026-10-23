<script setup lang="ts">
import { computed } from 'vue'

/** Replacement for MoneyComponent.vue (v-money): thousands separators, 0 decimals by default, emits a number. */
const props = withDefaults(
  defineProps<{ modelValue: number | null; name?: string; precision?: number; placeholder?: string }>(),
  {
    name: 'amount',
    precision: 0,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const display = computed(() =>
  props.modelValue === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: props.precision,
        maximumFractionDigits: props.precision,
      }).format(props.modelValue),
)

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/[^\d]/g, '')
  if (digits === '') {
    emit('update:modelValue', null)
    input.value = ''
    return
  }
  const value = Number(digits) / 10 ** props.precision
  emit('update:modelValue', value)
  input.value = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: props.precision,
    maximumFractionDigits: props.precision,
  }).format(value)
}
</script>

<template>
  <div>
    <input
      type="text"
      inputmode="numeric"
      class="w-full rounded border border-slate-300 px-3 py-2 text-right focus:border-primary-1 focus:outline-none"
      :value="display"
      :placeholder="placeholder"
      @input="onInput"
    />
    <input type="hidden" :name="name" :value="modelValue ?? 0" />
  </div>
</template>
