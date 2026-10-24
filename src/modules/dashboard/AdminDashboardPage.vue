<script setup lang="ts">
import { computed } from 'vue'
import DashboardTile from './DashboardTile.vue'
import { ADMIN_TILES } from './tiles'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const tiles = computed(() =>
  ADMIN_TILES.filter(
    (t) =>
      (!t.permission || auth.has(t.permission)) &&
      (!t.anyPermission || t.anyPermission.some((p) => auth.has(p))),
  ),
)
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <DashboardTile v-for="t in tiles" :key="t.title" :tile="t" />
  </div>
</template>
