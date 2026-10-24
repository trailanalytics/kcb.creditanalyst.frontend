<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { t24Api } from '../api'
import { groupImports } from '../logic'
import type { ImportedRecords } from '../types'

/** "T24 Imports": what the extracts pulled in over the last two days, one card per date. */
const data = ref<ImportedRecords | null>(null)
const loading = ref(true)
const error = ref('')
const groups = computed(() => groupImports(data.value))

onMounted(async () => {
  try {
    data.value = await t24Api.importedRecords()
  } catch (e) {
    error.value = messageOf(e, 'The import log could not be loaded.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="card">
    <div class="border-b border-slate-200 px-4 py-1 text-sm font-medium">T24 last 2 days data extraction</div>
    <div class="h-[400px] overflow-auto p-4">
      <p v-if="loading" class="text-sm text-muted">loading…</p>
      <p v-else-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <p v-else-if="!groups.length" class="text-sm text-muted">
        No extraction has finished in the last 2 days.
      </p>
      <div v-else class="grid gap-4 md:grid-cols-2">
        <div v-for="g in groups" :key="g.date" class="card p-3" data-testid="import-day">
          <div class="mb-2 text-right text-sm font-medium text-muted">{{ g.label }}</div>
          <ul class="divide-y divide-slate-100">
            <li v-for="log in g.logs" :key="log.id" class="py-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm">
                  <span class="mr-1 text-success" aria-hidden="true">&#10003;</span>{{ log.record_category }}
                </span>
                <span class="rounded-full bg-primary-1 px-2 py-0.5 text-xs font-medium text-white">
                  {{ (log.imported_records ?? 0).toLocaleString() }}
                </span>
              </div>
              <div class="text-xs text-muted">Time taken to complete task: {{ log.time_taken }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
