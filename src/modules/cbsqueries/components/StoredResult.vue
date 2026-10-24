<script setup lang="ts">
import { whenText } from '../statusModel'
import type { StoredValidation } from '../types'

/** The result the server stored for the latest submission: passed or failed, when, and how many errors and warnings. */
defineProps<{ result: StoredValidation }>()
</script>

<template>
  <p class="flex flex-wrap items-center gap-2 text-sm" data-testid="stored-result">
    <span
      class="rounded px-2 py-0.5 text-xs font-medium"
      :class="result.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
      data-testid="stored-passed"
      >{{ result.passed ? 'Passed' : 'Failed' }}</span
    >
    <span
      >{{ result.errorCount }} error{{ result.errorCount === 1 ? '' : 's' }},
      {{ result.warningCount }} warning{{ result.warningCount === 1 ? '' : 's' }}</span
    >
    <span v-if="result.runAt" class="text-muted">· checked {{ whenText(result.runAt) }}</span>
  </p>
</template>
