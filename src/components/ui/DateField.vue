<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import dayjs from 'dayjs'
import { computed } from 'vue'

/** Replacement for vuejs-datepicker. v-model is a `YYYY-MM-DD` string (the format the API and the old date inputs use). */
const props = defineProps<{
  modelValue: string | null
  placeholder?: string
  minDate?: string
  maxDate?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const date = computed(() => (props.modelValue ? dayjs(props.modelValue).toDate() : null))
const onUpdate = (value: Date | null) =>
  emit('update:modelValue', value ? dayjs(value).format('YYYY-MM-DD') : null)
</script>

<template>
  <VueDatePicker
    :model-value="date"
    :enable-time-picker="false"
    :auto-apply="true"
    :min-date="minDate ? dayjs(minDate).toDate() : undefined"
    :max-date="maxDate ? dayjs(maxDate).toDate() : undefined"
    :placeholder="placeholder ?? 'dd/mm/yyyy'"
    format="dd/MM/yyyy"
    @update:model-value="onUpdate"
  />
</template>
