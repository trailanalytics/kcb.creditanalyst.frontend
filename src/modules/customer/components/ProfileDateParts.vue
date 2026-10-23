<script setup lang="ts">
import { DAYS, MONTHS, yearsBack } from '../options'
import ProfileInput from './ProfileInput.vue'

/** Day / Month / Year selects (or Month / Year when `day` is empty); field names are `<prefix>Day<suffix>` etc. */
const props = defineProps<{
  day?: string
  month: string
  year: string
  /** Oldest year offered. */
  from: number
  /** Label of the blank option of the month select ("Month" or "--- select ---"). */
  monthBlank?: string
  yearBlank?: string
}>()
const years = yearsBack(props.from)
</script>

<template>
  <ProfileInput v-if="day" :name="day" :options="DAYS" blank="Day" width="w-1/4" />
  <ProfileInput :name="month" :options="MONTHS" :blank="monthBlank ?? 'Month'" width="flex-1" />
  <ProfileInput :name="year" :options="years" :blank="yearBlank ?? 'Year'" width="flex-1" />
</template>
