<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { blobFailure, filenameOf, saveBlob } from '@/modules/loans/download'
import { messageOf } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { hideLoader, showLoader, swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { processApi } from './api'
import {
  badgeClass,
  badgeLabel,
  escapeHtml,
  isActive,
  isRetryable,
  progressBarClass,
  startedLabel,
  truncate,
  typeLabel,
} from './processModel'
import type { BackgroundProcess } from './types'
import { useProcesses } from './useProcesses'

/** /background-processes: long running work (CBA files, PR4 updates, uploads) with live progress, downloads, and kill / mark complete / retry for managers. */
const auth = useAuthStore()
const canManage = computed(() => auth.has('Manage Background Processes'))
const { processes, currentPage, lastPage, total, loading, lastUpdated, fetchPage, start } = useProcesses()

onMounted(() => void start())

async function download(p: BackgroundProcess) {
  try {
    const response = await processApi.download(p.id)
    saveBlob(response.data, filenameOf(response.headers, `process-${p.id}`))
  } catch (e) {
    await swalNotification('error', await blobFailure(e, 'The file could not be downloaded.'))
  }
}

function viewResults(p: BackgroundProcess) {
  if (p.result_url) window.open(p.result_url, '_blank')
}

async function act(p: BackgroundProcess, call: (id: number) => Promise<{ message: string }>) {
  showLoader('Processing...')
  try {
    const result = await call(p.id)
    hideLoader()
    await swalNotification('success', result.message)
    await fetchPage(currentPage.value)
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'Something went wrong.'))
  }
}

async function kill(p: BackgroundProcess) {
  const r = await swalDelete.fire({
    icon: 'warning',
    title: 'Kill Process',
    html: `Stop and mark <strong>${escapeHtml(p.title)}</strong> as failed?<br><small class="text-muted">Use this for stuck or orphaned jobs.</small>`,
    showCancelButton: true,
    confirmButtonText: 'Yes, Kill It',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (r.isConfirmed) await act(p, processApi.kill)
}

async function markComplete(p: BackgroundProcess) {
  const r = await swalConfirm.fire({
    icon: 'warning',
    title: 'Mark as Complete',
    html: `Manually mark <strong>${escapeHtml(p.title)}</strong> as completed?<br><small class="text-muted">Only use this if you have verified the underlying work has actually finished.</small>`,
    showCancelButton: true,
    confirmButtonText: 'Yes, Mark Complete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (r.isConfirmed) await act(p, processApi.override)
}

async function retry(p: BackgroundProcess) {
  const r = await swalConfirm.fire({
    icon: 'info',
    title: 'Retry Process',
    html: `Re-run the loan update &amp; close steps for <strong>${escapeHtml(p.title)}</strong>?<br><small class="text-muted">PR4 data already imported will be reprocessed. A new background process will be created.</small>`,
    showCancelButton: true,
    confirmButtonText: 'Yes, Retry',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (r.isConfirmed) await act(p, processApi.retry)
}
</script>

<template>
  <section class="mx-auto max-w-7xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Background Processes
    </nav>

    <div class="mb-3 flex items-center justify-between">
      <h5 class="text-lg font-semibold">Background Processes</h5>
      <small v-if="lastUpdated" class="text-muted" data-testid="last-refreshed"
        >Last refreshed: {{ lastUpdated }}</small
      >
    </div>

    <div
      v-if="loading && processes.length === 0"
      class="card py-10 text-center text-muted"
      data-testid="loading"
    >
      Loading processes...
    </div>

    <div v-else-if="processes.length === 0" class="card py-10 text-center" data-testid="empty">
      <p class="text-muted">No background processes found.</p>
      <p class="mt-1 text-xs text-muted">
        Long-running tasks like CBA report generation and PR4 loan account updates will appear here.
      </p>
    </div>

    <div v-else class="card overflow-x-auto">
      <table class="w-full table-fixed text-sm" data-testid="processes">
        <colgroup>
          <col :style="{ width: canManage ? '20%' : '22%' }" />
          <col :style="{ width: canManage ? '24%' : '30%' }" />
          <col :style="{ width: canManage ? '15%' : '17%' }" />
          <col :style="{ width: canManage ? '15%' : '17%' }" />
          <col :style="{ width: canManage ? '10%' : '14%' }" />
          <col v-if="canManage" style="width: 16%" />
        </colgroup>
        <thead class="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th class="px-3 py-2">Process</th>
            <th class="px-3 py-2">Progress</th>
            <th class="px-3 py-2">Started</th>
            <th class="px-3 py-2">Completed</th>
            <th class="px-3 py-2">Action</th>
            <th v-if="canManage" class="px-3 py-2">Manage</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in processes"
            :key="p.id"
            class="border-b border-slate-100 align-top odd:bg-slate-50/50"
            :data-testid="`process-${p.id}`"
          >
            <td class="overflow-hidden px-3 py-3">
              <strong class="block truncate" :title="p.title">{{ p.title }}</strong>
              <small class="block uppercase text-muted">{{ typeLabel(p.type) }}</small>
              <small v-if="canManage && p.user_name" class="block text-muted">{{ p.user_name }}</small>
              <span
                class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs"
                :class="badgeClass(p.status)"
                data-testid="badge"
                >{{ badgeLabel(p.status) }}</span
              >
            </td>

            <td class="px-3 py-3">
              <div class="h-5 w-full overflow-hidden rounded bg-slate-200">
                <div
                  class="flex h-full items-center justify-center text-xs text-white transition-all"
                  :class="progressBarClass(p.status)"
                  :style="{ width: `${p.progress}%` }"
                  role="progressbar"
                  :aria-valuenow="p.progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <span v-if="p.status !== 'failed'">{{ p.progress }}%</span>
                </div>
              </div>
              <small class="mt-1 block break-words text-muted" data-testid="label">{{
                p.progress_label || ''
              }}</small>
              <small
                v-if="p.status === 'failed' && p.error_message"
                class="mt-1 block break-words text-danger"
                :title="p.error_message"
                data-testid="error"
              >
                ⚠ {{ truncate(p.error_message) }}
              </small>
            </td>

            <td class="whitespace-nowrap px-3 py-3">
              <small>{{ startedLabel(p) }}</small>
            </td>
            <td class="whitespace-nowrap px-3 py-3">
              <small>{{ p.completed_at || '—' }}</small>
            </td>

            <td class="px-3 py-3">
              <button
                v-if="p.has_file"
                type="button"
                class="rounded border border-success px-2 py-1 text-success hover:bg-success hover:text-white"
                title="Download File"
                data-testid="download"
                @click="download(p)"
              >
                Download
              </button>
              <button
                v-else-if="p.result_url"
                type="button"
                class="rounded bg-primary-1 px-2 py-1 text-white"
                title="View Results"
                data-testid="results"
                @click="viewResults(p)"
              >
                Results
              </button>
              <span v-else-if="p.status === 'failed'" class="text-xs text-danger">Failed</span>
              <span v-else-if="p.status === 'completed'" class="text-xs text-success">Done</span>
              <span v-else class="text-xs text-muted" data-testid="spinner">Running…</span>
            </td>

            <td v-if="canManage" class="px-3 py-3">
              <div class="flex flex-col gap-1">
                <button
                  v-if="isActive(p)"
                  type="button"
                  class="rounded border border-danger px-2 py-1 text-xs text-danger hover:bg-danger hover:text-white"
                  data-testid="kill"
                  @click="kill(p)"
                >
                  Kill
                </button>
                <button
                  v-if="p.status !== 'completed'"
                  type="button"
                  class="rounded border border-success px-2 py-1 text-xs text-success hover:bg-success hover:text-white"
                  data-testid="override"
                  @click="markComplete(p)"
                >
                  Mark Complete
                </button>
                <button
                  v-if="isRetryable(p)"
                  type="button"
                  class="rounded border border-primary-1 px-2 py-1 text-xs text-primary-1 hover:bg-primary-1 hover:text-white"
                  data-testid="retry"
                  @click="retry(p)"
                >
                  Retry
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="lastPage > 1" class="mt-3 flex items-center justify-between" data-testid="pagination">
      <small class="text-muted">{{ total }} processes total</small>
      <div class="flex items-center gap-2 text-sm">
        <button
          type="button"
          class="btn-outline"
          :disabled="currentPage === 1"
          data-testid="prev"
          @click="fetchPage(currentPage - 1)"
        >
          « Prev
        </button>
        <span class="text-muted">Page {{ currentPage }} of {{ lastPage }}</span>
        <button
          type="button"
          class="btn-outline"
          :disabled="currentPage === lastPage"
          data-testid="next"
          @click="fetchPage(currentPage + 1)"
        >
          Next »
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.progress-striped {
  background-image: linear-gradient(
    45deg,
    rgb(255 255 255 / 0.2) 25%,
    transparent 25%,
    transparent 50%,
    rgb(255 255 255 / 0.2) 50%,
    rgb(255 255 255 / 0.2) 75%,
    transparent 75%
  );
  background-size: 1rem 1rem;
}
</style>
