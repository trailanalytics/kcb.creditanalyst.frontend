<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { NavItem } from './types'

/** Second bar: KCB green for the CRB pages (navbar2) or white for the admin pages (admin_navbar2). */
defineProps<{ items: NavItem[]; variant?: 'green' | 'white' }>()
</script>

<template>
  <nav
    class="flex flex-wrap gap-x-8 gap-y-1 px-7 py-2 text-sm font-medium"
    :class="variant === 'white' ? 'border-b border-slate-200 bg-white text-ink' : 'bg-kcb-green text-white'"
  >
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="border-b-2 border-transparent py-1 hover:opacity-80"
      active-class="!border-current"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
