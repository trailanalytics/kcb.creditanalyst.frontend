<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import SubNav from '@/components/layout/SubNav.vue'
import type { NavItem } from '@/components/layout/types'
import { useAuthStore } from '@/stores/auth'
import { MANAGE_CBS_QUERIES, REVIEW_CBS_QUERIES } from '@/modules/cbsqueries/permissions'

/** CRB layout: navy bar + green section bar. Items and gates are those of layouts/navbar2.blade.php. */
const auth = useAuthStore()
const items = computed<NavItem[]>(() => {
  const list: NavItem[] = [
    { label: 'Dashboard', to: '/home' },
    { label: 'Profiles', to: '/profiles' },
    { label: 'Requests', to: '/requests' },
  ]
  if (auth.has('Download Crb Reports')) list.splice(2, 0, { label: 'Output Files', to: '/output-files' })
  if (auth.has('Sync T24')) list.push({ label: 'Configuration', to: '/t24' })
  if (auth.has('View Off Balance Sheet Items'))
    list.push({ label: 'Off Balance Sheet Items', to: '/off-balance-sheet/items' })
  if (auth.has(MANAGE_CBS_QUERIES) || auth.has(REVIEW_CBS_QUERIES))
    list.push({ label: 'CBS Query Configuration', to: '/cbs-queries' })
  if (auth.isAdmin) list.push({ label: 'Admin Dashboard', to: '/admin' })
  return list
})
</script>

<template>
  <div class="min-h-screen">
    <TopBar />
    <SubNav :items="items" />
    <main class="px-7 pt-4"><RouterView /></main>
  </div>
</template>
