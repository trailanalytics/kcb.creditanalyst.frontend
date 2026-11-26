<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DashboardTile from './DashboardTile.vue'
import type { Tile, TileMenuItem } from './types'
import { CRB_TILES } from './tiles'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { processApi } from '@/modules/processes/api'
import JointApplicationDialog from '@/modules/application/components/JointApplicationDialog.vue'
import NonExistingCustomerDialog from '@/modules/application/components/NonExistingCustomerDialog.vue'

const auth = useAuthStore()
const router = useRouter()
/**
 * A menu entry is offered when the user holds its own permission and the guard of the page it opens (meta.permission /
 * meta.anyPermission) would let the user in; the dialogs need Create Applications. Before UAT finding UD-08 most entries showed
 * to everyone and led to the 403 page, as on the Laravel dashboard.
 */
const ACTION_PERMISSION: Record<string, string> = { 'non-existing-customer': 'Create Applications', 'joint-application': 'Create Applications' }
function mayOpen(m: TileMenuItem): boolean {
  if (m.permission && !auth.has(m.permission)) return false
  if (m.action) return auth.has(ACTION_PERMISSION[m.action] ?? '')
  if (!m.to) return true
  if (!router) return true // mounted without a router (unit tests of the tiles alone)
  const meta = router.resolve(m.to).meta as { permission?: string; anyPermission?: string[] }
  if (meta.permission && !auth.has(meta.permission)) return false
  if (meta.anyPermission && !meta.anyPermission.some((x) => auth.has(x))) return false
  return true
}
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
    menu: t.menu?.filter(mayOpen),
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
