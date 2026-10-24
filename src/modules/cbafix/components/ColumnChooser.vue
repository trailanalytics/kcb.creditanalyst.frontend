<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CbaColumn } from '../types'

/**
 * "Check / Uncheck CBA Columns": which columns the grid shows. Hiding only changes the view, the rows keep every value, so
 * nothing moves and nothing is saved into another column. The two key columns stay.
 */
const props = defineProps<{ columns: CbaColumn[] }>()
const visible = defineModel<boolean[]>({ required: true })

const filter = ref('')

const listed = computed(() => {
  const q = filter.value.trim().toLowerCase()
  return props.columns.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.label.toLowerCase().includes(q))
})
const all = computed(() => visible.value.every(Boolean))

function toggleAll(checked: boolean) {
  visible.value = props.columns.map((c) => checked || c.readonly)
}

function toggle(index: number, checked: boolean) {
  const next = [...visible.value]
  next[index] = checked
  visible.value = next
}
</script>

<template>
  <div class="card flex max-h-[315px] flex-col p-3 text-sm" data-testid="column-chooser">
    <label class="flex items-center gap-2 font-medium">
      <input
        type="checkbox"
        :checked="all"
        @change="toggleAll(($event.target as HTMLInputElement).checked)"
      />
      Check / Uncheck CBA Columns
    </label>
    <p class="mt-1 text-xs text-muted">(Uncheck the columns you don't want to see.)</p>
    <input
      v-model="filter"
      type="text"
      class="mb-2 border-b border-slate-300 bg-transparent py-1 text-xs outline-none"
      placeholder="search columns..."
    />
    <div class="overflow-auto">
      <label v-for="{ c, i } in listed" :key="c.key" class="flex items-center gap-2 py-0.5 text-xs">
        <input
          type="checkbox"
          :checked="visible[i]"
          :disabled="c.readonly"
          :data-column-toggle="c.key"
          @change="toggle(i, ($event.target as HTMLInputElement).checked)"
        />
        {{ c.label }}
      </label>
    </div>
  </div>
</template>
