<script setup lang="ts">
/** The trash icon of the list rows, shown beside the edit pencil when the user may request deletions. */
defineProps<{ label: string }>()
</script>

<template>
  <button
    type="button"
    class="ml-3 align-middle text-slate-500 hover:text-danger"
    :aria-label="label"
    :title="label"
  >
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
    </svg>
  </button>
</template>
