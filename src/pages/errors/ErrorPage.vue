<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ERRORS, FALLBACK } from './errorMessages'
import NotifyIt from './NotifyIt.vue'

const route = useRoute()
const router = useRouter()

const info = computed(() => ERRORS[String(route.params.code)] ?? FALLBACK)
const reference = computed(() => (typeof route.query.ref === 'string' ? route.query.ref : null))

const reload = () => window.location.reload()
const goBack = () => (window.history.length > 1 ? router.back() : router.push({ name: 'home' }))
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6">
    <section
      class="w-full max-w-lg rounded-xl border border-slate-200 bg-white px-9 py-10 text-center shadow-lg"
    >
      <img src="/img/KCB.logo.png" alt="KCB" class="mx-auto mb-7 h-11" />
      <span
        class="mb-3 inline-block rounded-full bg-project/10 px-3 py-1 text-xs font-semibold tracking-wide text-project"
      >
        {{ info.code }}
      </span>
      <h1 class="mb-3 text-2xl font-semibold text-ink">{{ info.title }}</h1>
      <p class="mb-7 text-sm leading-relaxed text-slate-500">{{ info.message }}</p>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <button
          v-if="info.code === '500'"
          type="button"
          class="rounded border border-project px-4 py-2 text-sm font-medium text-project"
          @click="goBack"
        >
          Go Back
        </button>
        <RouterLink
          v-if="info.code === '401'"
          :to="{ name: 'login' }"
          class="rounded bg-project px-4 py-2 text-sm font-medium text-white"
        >
          Go to Login
        </RouterLink>
        <button
          v-else-if="info.code === '419' || info.code === '503'"
          type="button"
          class="rounded bg-project px-4 py-2 text-sm font-medium text-white"
          @click="info.code === '419' ? goBack() : reload()"
        >
          {{ info.code === '419' ? 'Refresh Page' : 'Try Again' }}
        </button>
        <RouterLink
          v-else
          :to="{ name: 'home' }"
          class="rounded bg-project px-4 py-2 text-sm font-medium text-white"
        >
          Go to Home
        </RouterLink>
      </div>
      <p v-if="reference" class="mt-6 text-xs text-slate-400">Error reference: {{ reference }}</p>
      <NotifyIt v-if="reference && info.code === '500'" :reference="reference" />
    </section>
  </main>
</template>
