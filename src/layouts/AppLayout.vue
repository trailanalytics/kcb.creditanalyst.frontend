<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="min-h-screen">
    <!-- Top bar: navy, as in layouts/app.blade.php navbar1 -->
    <header class="flex items-center justify-between bg-kcb-navy px-6 py-3 text-white">
      <div class="flex items-center gap-3">
        <img src="/img/KCB.logo.png" alt="KCB" class="h-8" />
        <span class="text-lg font-semibold">Credit Analyst</span>
      </div>
      <span class="text-sm text-slate-200">{{ auth.user?.name }}</span>
    </header>
    <!-- Section bar: KCB green, as in navbar2 -->
    <nav class="flex gap-6 bg-kcb-green px-6 py-2 text-sm font-medium text-white">
      <RouterLink :to="{ name: 'home' }">Dashboard</RouterLink>
    </nav>
    <div class="p-6">
      <RouterView />
    </div>
  </div>
</template>
