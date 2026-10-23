<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { useCollection } from '@/composables/useCollection'
import DropFile from '@/components/ui/DropFile.vue'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import { applicationsApi } from './api'
import { crbToDisplay } from './loanModel'
import { showFailure } from './submit'
import { APPROVED, PENDING, type BulkItem, type PendingRow } from './types'

/** /applications/bulk-approve: the user's uploaded list of CAPs, decided in one go (cap/approval_list.blade.php). */
const ref_ = useReferenceStore()
const { items, loading, completed, loadMore, reload } = useCollection<PendingRow>('/applications/pending')
const choices = reactive<Record<string, { status: string; contractCode: string; rejectionReason: string }>>(
  {},
)
const uploadOpen = ref(false)
const file = ref<File | null>(null)
const busy = ref(false)

onMounted(() => {
  void ref_.load('application-statuses', 'rejection-reasons')
  void loadMore()
})

// every listed reference gets its own row state, started from what the application already says
watch(
  () => items.value,
  (rows) => {
    for (const r of rows) {
      if (choices[r.creditApplicationReference]) continue
      choices[r.creditApplicationReference] = {
        status: r.application?.creditApplicationStatus ?? PENDING,
        contractCode: r.application?.approval?.contractCode ?? '',
        rejectionReason: r.application?.rejection?.rejectionReason ?? '',
      }
    }
  },
  { deep: true, immediate: true },
)

async function save() {
  const payload: BulkItem[] = Object.entries(choices)
    .filter(([, c]) => c.status !== PENDING)
    .map(([creditApplicationReference, c]) => ({
      creditApplicationReference,
      creditApplicationStatus: c.status,
      contractCode: c.status === APPROVED ? c.contractCode : undefined,
      rejectionReason: c.status !== APPROVED ? c.rejectionReason : undefined,
    }))
  if (!payload.length) return void swalNotification('error', 'Choose a status for at least one application.')
  busy.value = true
  showLoader('processing...')
  try {
    const result = await applicationsApi.bulkApprove(payload)
    hideLoader()
    await swalNotification(result.skipped.length ? 'error' : 'success', result.message)
    Object.keys(choices).forEach((k) => delete choices[k])
    await reload()
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}

async function upload() {
  if (!file.value) return void swalNotification('error', 'Choose the credit applications template first.')
  busy.value = true
  showLoader('uploading...')
  try {
    const result = await applicationsApi.upload(file.value)
    hideLoader()
    uploadOpen.value = false
    file.value = null
    Object.keys(choices).forEach((k) => delete choices[k])
    await reload()
    await swalNotification(
      result.unknown.length ? 'warning' : 'success',
      result.unknown.length ? `${result.message}. Not found: ${result.unknown.join(', ')}` : result.message,
    )
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}

async function download() {
  const { data } = await applicationsApi.downloadPending()
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pending-applications.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Bulk Approval
      </nav>
      <div class="ml-auto flex gap-2">
        <button type="button" class="btn-primary-1" @click="uploadOpen = true">Upload New List</button>
        <button type="button" class="btn-primary-1 !bg-kcb-green" :disabled="busy" @click="save">
          SAVE CHANGES
        </button>
        <button type="button" class="btn-outline" @click="download">Download List</button>
      </div>
    </div>

    <div class="card">
      <div
        v-for="r in items"
        :key="r.id"
        class="flex flex-wrap items-center gap-4 border-b border-slate-100 p-4 text-sm last:border-0"
      >
        <img src="/img/profile-placeholder.jpg" alt="" width="50" class="rounded" />
        <div class="basis-1/4">
          <div class="font-medium text-project">
            {{ r.application?.customer?.full_name.trim() || 'Unknown customer' }}
          </div>
          <div class="text-xs text-muted">{{ r.application?.clientNumber }}</div>
        </div>
        <div class="basis-1/6">
          <small class="block text-muted">Ref No</small>{{ r.creditApplicationReference }}
        </div>
        <div class="basis-1/6">
          {{ r.application?.currency }} {{ formatNumber(r.application?.Amount) }}
          <small class="block text-muted">{{ crbToDisplay(r.application?.creditApplicationDate) }}</small>
        </div>
        <template v-if="choices[r.creditApplicationReference]">
          <select
            v-model="choices[r.creditApplicationReference]!.status"
            class="form-input w-40"
            :aria-label="`Status of ${r.creditApplicationReference}`"
          >
            <option v-for="s in ref_.items('application-statuses')" :key="s.code" :value="s.code">
              {{ s.value }}
            </option>
          </select>
          <input
            v-if="choices[r.creditApplicationReference]!.status === APPROVED"
            v-model="choices[r.creditApplicationReference]!.contractCode"
            class="form-input w-48"
            placeholder="Loan account"
            :aria-label="`Loan account of ${r.creditApplicationReference}`"
          />
          <select
            v-else-if="choices[r.creditApplicationReference]!.status !== PENDING"
            v-model="choices[r.creditApplicationReference]!.rejectionReason"
            class="form-input w-48"
            :aria-label="`Rejection reason of ${r.creditApplicationReference}`"
          >
            <option value="">--- select ---</option>
            <option v-for="x in ref_.items('rejection-reasons')" :key="x.code" :value="x.code">
              {{ x.value }}
            </option>
          </select>
        </template>
      </div>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No applications on your list. Upload a new list to start."
      @load="loadMore"
    />

    <DialogRoot v-model:open="uploadOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
        <DialogContent
          class="fixed left-1/2 top-24 z-50 w-[min(34rem,92vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
          aria-describedby="undefined"
        >
          <DialogTitle class="mb-3 text-base font-semibold text-project"
            >Upload credit applications</DialogTitle
          >
          <a
            href="/templates/CREDIT APPLICATION TEMPLATE.xlsx"
            class="mb-3 block text-sm text-primary-1"
            download
            >Download credit applications template.xlsx</a
          >
          <DropFile
            accept=".xlsx,.xls,.csv"
            label="Drag & Drop credit applications template or browse"
            @file="file = $event"
          />
          <div class="mt-5 flex justify-end gap-2">
            <DialogClose class="btn-outline">Close</DialogClose>
            <button type="button" class="btn-primary-1" :disabled="busy" @click="upload">UPLOAD</button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>
