<script setup lang="ts">
import { DAYS, MONTHS, yearOptions } from '../reportModel'
import type { DateParts } from '../types'

/** Day, month and year as three selects of equal width, the way the old form asked for a date. */
const model = defineModel<DateParts>({ required: true })
defineProps<{ name: string; label: string }>()
const years = yearOptions()
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <select
      v-model="model.day"
      class="form-input"
      required
      :name="`${name}_day`"
      :aria-label="`${label} day`"
    >
      <option value="" disabled>Day</option>
      <option v-for="d in DAYS" :key="d" :value="d">{{ d }}</option>
    </select>
    <select
      v-model="model.month"
      class="form-input"
      required
      :name="`${name}_month`"
      :aria-label="`${label} month`"
    >
      <option value="" disabled>Month</option>
      <option v-for="(m, i) in MONTHS" :key="m" :value="String(i + 1)">{{ m }}</option>
    </select>
    <select
      v-model="model.year"
      class="form-input"
      required
      :name="`${name}_year`"
      :aria-label="`${label} year`"
    >
      <option value="" disabled>Year</option>
      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
    </select>
  </div>
</template>
