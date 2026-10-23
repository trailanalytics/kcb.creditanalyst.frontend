<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="mx-auto max-w-2xl px-7 pt-10 text-center">
    <h1 class="text-2xl font-semibold text-project">{{ route.meta.title }}</h1>
    <p class="mt-3 text-slate-500">
      This screen has not been moved to the new system yet. It arrives with milestone
      <b>{{ route.meta.milestone }}</b
      >.
    </p>
  </section>
</template>
