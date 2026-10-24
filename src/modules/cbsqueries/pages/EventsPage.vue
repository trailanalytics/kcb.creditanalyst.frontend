<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import { cbsApi } from '../api'
import CbsTabs from '../components/CbsTabs.vue'
import EventsTable from '../components/EventsTable.vue'
import { toEvent } from '../normalize'
import type { AuditEvent, CoreSystem, ModuleSummary } from '../types'

/** The audit trail across versions, filterable by module and core system, loaded page by page as the list scrolls. */
const coreSystem = ref('')
const moduleCode = ref('')
const coreSystems = ref<CoreSystem[]>([])
const modules = ref<ModuleSummary[]>([])

const { items, loading, completed, error, loadMore, reload } = useCollection<{ id?: number }>(
  '/cbs-queries/events',
  {
    params: () => ({
      ...(coreSystem.value ? { coreSystem: coreSystem.value } : {}),
      ...(moduleCode.value ? { module: moduleCode.value } : {}),
    }),
  },
)
const events = () => (items.value as unknown[]).map(toEvent) as AuditEvent[]

onMounted(async () => {
  void loadMore()
  try {
    ;[coreSystems.value, modules.value] = await Promise.all([cbsApi.coreSystems(), cbsApi.modules()])
  } catch {
    // the filters stay empty; the list itself still works
  }
})
watch([coreSystem, moduleCode], () => void reload())
</script>

<template>
  <section class="px-2">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
        <RouterLink to="/cbs-queries" class="text-primary-1">CBS Query Configuration</RouterLink> /
        <span class="text-ink">Events</span>
      </nav>
      <div class="ml-auto flex flex-wrap items-center gap-3">
        <label class="flex">
          <span
            class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm whitespace-nowrap"
            >Core system</span
          >
          <select
            v-model="coreSystem"
            class="form-input rounded-l-none"
            aria-label="Core system"
            data-testid="core-system"
          >
            <option value="">All</option>
            <option v-for="c in coreSystems" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </label>
        <label class="flex">
          <span
            class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm whitespace-nowrap"
            >Module</span
          >
          <select
            v-model="moduleCode"
            class="form-input rounded-l-none"
            aria-label="Module"
            data-testid="module"
          >
            <option value="">All</option>
            <option v-for="m in modules" :key="m.code" :value="m.code">{{ m.name }}</option>
          </select>
        </label>
      </div>
    </div>
    <CbsTabs />

    <div class="card">
      <EventsTable :events="events()" show-version />
      <p v-if="error" class="px-4 py-3 text-sm text-danger" data-testid="load-error">
        Failed to load events. Please refresh and try again.
      </p>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0 && !error"
      empty-text="No events found."
      @load="loadMore"
    />
  </section>
</template>
