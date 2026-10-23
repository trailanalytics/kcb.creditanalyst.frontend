<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

/** Replacement for vue-infinite-loading: emits `load` whenever the sentinel scrolls into view and more data is expected. */
const props = defineProps<{ loading: boolean; completed: boolean; emptyText?: string; isEmpty?: boolean }>()
const emit = defineEmits<{ load: [] }>()

const sentinel = ref<HTMLElement | null>(null)
useIntersectionObserver(sentinel, ([entry]) => {
  if (entry?.isIntersecting && !props.loading && !props.completed) emit('load')
})
</script>

<template>
  <div ref="sentinel" class="py-3 text-center text-sm text-muted">
    <span v-if="loading">loading…</span>
    <span v-else-if="completed && isEmpty">{{ emptyText ?? 'No results found.' }}</span>
  </div>
</template>
