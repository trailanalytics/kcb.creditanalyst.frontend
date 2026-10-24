<script setup lang="ts">
import { computed } from 'vue'
import { statusInfo, TONE_CLASS } from '../statusModel'
import type { VersionStatus } from '../types'

/** The version status as a small coloured label. */
const props = defineProps<{ status: VersionStatus }>()
const info = computed(() => statusInfo(props.status))
</script>

<template>
  <span
    class="inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium"
    :class="TONE_CLASS[info.tone]"
    data-testid="status-badge"
    >{{ info.label }}</span
  >
</template>
