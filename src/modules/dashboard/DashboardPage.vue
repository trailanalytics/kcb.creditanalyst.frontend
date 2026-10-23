<script setup lang="ts">
import { computed } from 'vue'
import DashboardTile from './DashboardTile.vue'
import type { Tile } from './types'
import { CRB_TILES } from './tiles'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const tiles = computed<Tile[]>(() =>
  CRB_TILES.filter((t) => !t.permission || auth.has(t.permission)).map((t) => ({
    ...t,
    menu: t.menu?.filter((m) => !m.permission || auth.has(m.permission)),
  })),
)
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <DashboardTile v-for="t in tiles" :key="t.title" :tile="t" />
  </div>
</template>
