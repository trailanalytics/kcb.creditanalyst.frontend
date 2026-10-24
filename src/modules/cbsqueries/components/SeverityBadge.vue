<script setup lang="ts">
import { SEVERITY_TONE, TONE_CLASS } from '../statusModel'
import type { Severity } from '../types'

defineProps<{ severity: Severity }>()
</script>

<template>
  <span
    class="inline-block rounded px-2 py-0.5 text-xs font-medium uppercase"
    :class="TONE_CLASS[SEVERITY_TONE[severity]]"
    data-testid="severity"
    >{{ severity }}</span
  >
</template>
