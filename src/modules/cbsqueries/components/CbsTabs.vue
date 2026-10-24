<script setup lang="ts">
import { RouterLink } from 'vue-router'

/** The three list pages of the module, side by side under the breadcrumb. */
const tabs = [
  { label: 'Overview', to: '/cbs-queries' },
  { label: 'Sample library', to: '/cbs-queries/samples' },
  { label: 'Events', to: '/cbs-queries/events' },
]
</script>

<template>
  <nav class="mb-4 flex gap-6 border-b border-slate-200 text-sm" aria-label="CBS Query Configuration">
    <RouterLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="-mb-px border-b-2 border-transparent px-1 py-2 text-slate-600 hover:text-ink"
      exact-active-class="!border-primary-1 !text-ink font-medium"
    >
      {{ t.label }}
    </RouterLink>
  </nav>
</template>
