<script setup lang="ts">
import { computed } from 'vue'
import { statusInfo, TONE_CLASS } from '../statusModel'
import type { VersionStatus } from '../types'
import StatusBadge from './StatusBadge.vue'

/** One line under the page title: the status and what happens next. */
const props = defineProps<{ status: VersionStatus }>()
const info = computed(() => statusInfo(props.status))
</script>

<template>
  <div
    class="mb-4 flex flex-wrap items-center gap-3 rounded border border-slate-200 px-4 py-3 text-sm"
    :class="TONE_CLASS[info.tone]"
    role="status"
    data-testid="status-banner"
  >
    <StatusBadge :status="status" />
    <span>{{ info.message }}</span>
  </div>
</template>
