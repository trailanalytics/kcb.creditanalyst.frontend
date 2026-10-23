<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import SubNav from '@/components/layout/SubNav.vue'
import type { NavItem } from '@/components/layout/types'
import { useAuthStore } from '@/stores/auth'

/** Admin layout: navy bar + white section bar (layouts/admin_navbar2.blade.php). */
const auth = useAuthStore()
const items = computed<NavItem[]>(() => {
  const list: NavItem[] = [
    { label: 'Dashboard', to: '/admin' },
    { label: 'Requests', to: '/requests' },
  ]
  if (auth.has('Sync T24')) list.push({ label: 'Sync T24', to: '/t24' })
  list.push({ label: 'CRB Dashboard', to: '/home' })
  return list
})
</script>

<template>
  <div class="min-h-screen">
    <TopBar />
    <SubNav :items="items" variant="white" />
    <main class="px-7 pt-4"><RouterView /></main>
  </div>
</template>
