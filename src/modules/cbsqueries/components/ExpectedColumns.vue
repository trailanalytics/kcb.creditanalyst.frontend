<script setup lang="ts">
import { computed } from 'vue'
import { columnStates, columnSummary } from '../columnModel'
import type { Finding, ModuleColumn } from '../types'

/** The columns the module reads, each with a tick when the query produces it, a cross when it does not, a dot while unknown. */
const props = defineProps<{
  columns: ModuleColumn[]
  findings: Finding[] | null
  bindCount?: number | null
}>()
const states = computed(() => columnStates(props.columns, props.findings))
const summary = computed(() => columnSummary(states.value))
</script>

<template>
  <aside class="card" data-testid="expected-columns">
    <header class="border-b border-slate-100 px-4 py-3">
      <h3 class="text-sm font-semibold text-project">Expected columns</h3>
      <p class="text-xs text-muted" data-testid="columns-summary">
        {{ summary ?? 'Not checked yet'
        }}<template v-if="bindCount !== null && bindCount !== undefined">
          · {{ bindCount }} bind{{ bindCount === 1 ? '' : 's' }} (?)</template
        >
      </p>
    </header>
    <ul class="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto text-sm">
      <li
        v-for="c in columns"
        :key="c.name"
        class="flex items-start gap-2 px-4 py-2"
        :data-testid="`column-${c.name}`"
        :data-state="states.get(c.name)"
      >
        <span
          v-if="states.get(c.name) === 'ok'"
          class="mt-0.5 font-bold text-success"
          title="The query produces this column"
          aria-label="produced"
          >&#10003;</span
        >
        <span
          v-else-if="states.get(c.name) === 'missing'"
          class="mt-0.5 font-bold text-danger"
          title="The query does not produce this column"
          aria-label="not produced"
          >&#10007;</span
        >
        <span v-else class="mt-0.5 text-slate-400" title="Not checked" aria-label="not checked">&#9675;</span>
        <span class="min-w-0">
          <code class="break-all text-xs">{{ c.name }}</code>
          <span v-if="c.required" class="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-600"
            >required</span
          >
          <small v-if="c.description" class="block text-xs text-muted">{{ c.description }}</small>
        </span>
      </li>
    </ul>
  </aside>
</template>
