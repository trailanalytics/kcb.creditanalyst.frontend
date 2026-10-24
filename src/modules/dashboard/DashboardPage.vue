<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DashboardTile from './DashboardTile.vue'
import type { Tile } from './types'
import { CRB_TILES } from './tiles'
import { useAuthStore } from '@/stores/auth'
import { processApi } from '@/modules/processes/api'
import JointApplicationDialog from '@/modules/application/components/JointApplicationDialog.vue'
import NonExistingCustomerDialog from '@/modules/application/components/NonExistingCustomerDialog.vue'

const auth = useAuthStore()
const jointOpen = ref(false)
const nonExistingOpen = ref(false)
const onAction = (a: string) => {
  if (a === 'joint-application') jointOpen.value = true
  else nonExistingOpen.value = true
}
/** The number on the PROCESSES tile: every process pending or running, whoever started it (only asked for by users who see the tile). */
const activeProcesses = ref(0)
onMounted(async () => {
  if (!auth.has('View Analysis')) return
  try {
    activeProcesses.value = await processApi.activeCount()
  } catch {
    activeProcesses.value = 0
  }
})
const tiles = computed<Tile[]>(() =>
  CRB_TILES.filter((t) => !t.permission || auth.has(t.permission)).map((t) => ({
    ...t,
    menu: t.menu?.filter((m) => !m.permission || auth.has(m.permission)),
    badge: t.to === '/background-processes' ? activeProcesses.value : undefined,
  })),
)
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <DashboardTile v-for="t in tiles" :key="t.title" :tile="t" @action="onAction" />
    <JointApplicationDialog v-model:open="jointOpen" />
    <NonExistingCustomerDialog v-model:open="nonExistingOpen" />
  </div>
</template>
