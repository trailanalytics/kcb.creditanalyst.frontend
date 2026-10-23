<script setup lang="ts">
import { computed } from 'vue'
import type { PermissionGroup } from './types'

/**
 * Permission checkboxes grouped by module, with a tick-all box per group (resources/js/components/Admin/PermissionBatch.vue).
 * The Admin group is not offered to the `crb` role, as before; v-model is the list of permission ids.
 */
const props = defineProps<{ groups: PermissionGroup[]; modelValue: number[]; role: string }>()
const emit = defineEmits<{ 'update:modelValue': [ids: number[]] }>()

const visible = computed(() => props.groups.filter((g) => !(g.group === 'Admin' && props.role === 'crb')))
const selected = computed(() => new Set(props.modelValue))

const groupState = (g: PermissionGroup) => {
  const n = g.permissions.filter((p) => selected.value.has(p.id)).length
  return { all: n === g.permissions.length, some: n > 0 && n < g.permissions.length }
}

function toggle(id: number, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(id)
  else next.delete(id)
  emit('update:modelValue', [...next])
}

function toggleGroup(g: PermissionGroup, on: boolean) {
  const next = new Set(selected.value)
  g.permissions.forEach((p) => (on ? next.add(p.id) : next.delete(p.id)))
  emit('update:modelValue', [...next])
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <fieldset v-for="g in visible" :key="g.group" class="rounded border border-slate-200 bg-white p-4">
      <legend class="sr-only">{{ g.group }}</legend>
      <label class="mb-2 flex items-center gap-2 font-semibold text-project">
        <input
          type="checkbox"
          :checked="groupState(g).all"
          :indeterminate="groupState(g).some"
          :aria-label="`Select all ${g.group} permissions`"
          @change="toggleGroup(g, ($event.target as HTMLInputElement).checked)"
        />
        {{ g.group }}
      </label>
      <label v-for="p in g.permissions" :key="p.id" class="flex items-center gap-2 py-0.5 text-sm">
        <input
          type="checkbox"
          :checked="selected.has(p.id)"
          @change="toggle(p.id, ($event.target as HTMLInputElement).checked)"
        />
        {{ p.name }}
      </label>
    </fieldset>
  </div>
</template>
