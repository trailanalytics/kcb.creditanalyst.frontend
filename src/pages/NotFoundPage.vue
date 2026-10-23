<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-3">
    <h1 class="text-4xl font-semibold text-project">404</h1>
    <p class="text-muted">The page you are looking for does not exist.</p>
    <RouterLink :to="{ name: 'home' }" class="text-primary-1 underline">Back to dashboard</RouterLink>
  </main>
</template>
