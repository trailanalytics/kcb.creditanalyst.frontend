<script setup lang="ts">
/** One form row (.form-group.d-flex.w-inputs): right-aligned label and the controls. */
defineProps<{ label: string; forId?: string; star?: boolean }>()
</script>

<template>
  <div class="mb-3 flex flex-col gap-1 md:flex-row md:items-start md:gap-4">
    <label :for="forId" class="pt-2 text-sm text-slate-700 md:w-1/4 md:text-right">
      {{ label }}<span v-if="star" class="text-danger"> *</span>
    </label>
    <div class="flex min-w-0 flex-1 gap-2"><slot /></div>
  </div>
</template>
