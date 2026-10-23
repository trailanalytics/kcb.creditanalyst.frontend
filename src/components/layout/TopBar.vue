<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { timeOfDayGreeting } from '@/utils/greeting'
import GlobalSearch from './GlobalSearch.vue'

/** First bar of every signed-in page (layouts/navbar1.blade.php): logo, title, greeting, logout. */
const auth = useAuthStore()
const router = useRouter()
const greeting = computed(() => `${timeOfDayGreeting()}, ${auth.user?.lastname ?? ''}`.replace(/,\s*$/, ''))

async function logout() {
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-kcb-navy">
    <div class="flex items-center gap-6 px-7 py-2 text-white">
      <img src="/img/KCB.logo.png" alt="KCB" class="w-[65px]" />
      <div class="leading-tight">
        <div class="text-lg font-semibold">Credit Analyst</div>
        <small class="text-sm">{{ greeting }}</small>
      </div>
      <div class="flex flex-1 justify-center"><GlobalSearch /></div>
      <button
        type="button"
        class="text-danger hover:opacity-80"
        title="Log out"
        aria-label="Log out"
        @click="logout"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  </header>
</template>
