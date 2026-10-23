<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardTile from './DashboardTile.vue'
import type { Tile } from './types'
import { CRB_TILES } from './tiles'
import { useAuthStore } from '@/stores/auth'
import JointApplicationDialog from '@/modules/application/components/JointApplicationDialog.vue'
import NonExistingCustomerDialog from '@/modules/application/components/NonExistingCustomerDialog.vue'

const auth = useAuthStore()
const jointOpen = ref(false)
const nonExistingOpen = ref(false)
const onAction = (a: string) => {
  if (a === 'joint-application') jointOpen.value = true
  else nonExistingOpen.value = true
}
const tiles = computed<Tile[]>(() =>
  CRB_TILES.filter((t) => !t.permission || auth.has(t.permission)).map((t) => ({
    ...t,
    menu: t.menu?.filter((m) => !m.permission || auth.has(m.permission)),
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
