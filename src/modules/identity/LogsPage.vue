<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import ExportDialog from './ExportDialog.vue'
import { logsApi } from './api'
import type { DeletedCount, LogRow } from './types'

/** Logs and statistics (manage-stats): activity log, login log and the count of soft-deleted records per table. */
type Tab = 'activity' | 'login' | 'deleted'
const tab = ref<Tab>('activity')

const activity = useCollection<LogRow>('/activity-logs')
const logins = useCollection<LogRow>('/login-logs')
const deleted = ref<DeletedCount[]>([])
const deletedLoaded = ref(false)

const current = () => (tab.value === 'login' ? logins : activity)

onMounted(() => void activity.loadMore())
watch(tab, async (t) => {
  if (t === 'login' && logins.items.value.length === 0) await logins.loadMore()
  if (t === 'deleted' && !deletedLoaded.value) {
    deleted.value = (await logsApi.deletedRecords()).data
    deletedLoaded.value = true
  }
})

const who = (l: LogRow) => (l.user ? `${l.user.firstname ?? ''} ${l.user.lastname ?? ''}`.trim() : 'N/F')
const when = (l: LogRow) => (l.createdAt ? dayjs(l.createdAt).format('D, MMM YYYY') : '')
const tabs: { key: Tab; label: string }[] = [
  { key: 'activity', label: 'Activity Logs' },
  { key: 'login', label: 'Login Logs' },
  { key: 'deleted', label: 'Deleted Records' },
]
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold text-project">Logs and Statistics</h1>
      <input
        v-if="tab !== 'deleted'"
        v-model="current().search.value"
        type="search"
        placeholder="Search logs"
        class="ml-auto w-72 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-1 focus:outline-none"
        aria-label="Search logs"
      />
      <div :class="tab === 'deleted' ? 'ml-auto' : ''"><ExportDialog /></div>
    </div>

    <div class="mb-3 flex gap-1 border-b border-slate-200" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="
          tab === t.key ? 'border-project font-semibold text-project' : 'border-transparent text-slate-500'
        "
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <template v-if="tab !== 'deleted'">
      <div class="overflow-x-auto rounded border border-slate-200 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Title</th>
              <th class="px-4 py-3">Description</th>
              <th class="px-4 py-3">Activity By</th>
              <th class="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in current().items.value" :key="l.id" class="border-t border-slate-100">
              <td class="px-4 py-2">{{ l.title }}</td>
              <td class="px-4 py-2">{{ l.activity }}</td>
              <td class="px-4 py-2">{{ who(l) }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ when(l) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <InfiniteScroll
        :loading="current().loading.value"
        :completed="current().completed.value"
        :is-empty="current().items.value.length === 0"
        @load="current().loadMore()"
      />
    </template>

    <div v-else class="overflow-x-auto rounded border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Table</th>
            <th class="px-4 py-3 text-right">Deleted records</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in deleted" :key="d.name" class="border-t border-slate-100">
            <td class="px-4 py-2">{{ d.name }}</td>
            <td class="px-4 py-2 text-right">{{ d.count }}</td>
          </tr>
          <tr v-if="deletedLoaded && deleted.length === 0">
            <td colspan="2" class="px-4 py-6 text-center text-muted">No deleted records.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
