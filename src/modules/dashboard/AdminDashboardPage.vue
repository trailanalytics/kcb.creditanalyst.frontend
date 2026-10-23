<script setup lang="ts">
import DashboardTile from './DashboardTile.vue'
import { ADMIN_TILES } from './tiles'
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <DashboardTile v-for="t in ADMIN_TILES" :key="t.title" :tile="t" />
  </div>
</template>
