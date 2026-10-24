<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { messageOf } from '@/api/http'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import { useAuthStore } from '@/stores/auth'
import { hideLoader, showLoader, swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { requestApi } from './api'
import RecordModal from './components/RecordModal.vue'
import {
  actionsFor,
  APPROVE_TEXT,
  CANCEL_TEXT,
  recordText,
  requestedOn,
  STATUS_OPTIONS,
} from './requestModel'
import type { DeletionRequestRow, RequestStatus } from './types'

/**
 * /requests: the maker-checker list of deletion requests (RequestIndex.vue). Filter by status, search by exact request id or record id,
 * look at the record, approve ("Accept & Delete") or cancel ("Decline & Maintain") a pending request.
 */
const auth = useAuthStore()
const status = ref<RequestStatus>(0)
const { items, search, loading, completed, error, loadMore, reload } = useCollection<DeletionRequestRow>(
  '/deletion-requests',
  {
    params: () => ({ status: status.value }),
  },
)
onMounted(loadMore)

const me = computed(() => ({
  id: auth.user?.id ?? null,
  canApprove: auth.has('Approve Deletion Requests'),
  canCancel: auth.has('Cancel Deletion Requests'),
}))
const actions = (row: DeletionRequestRow) => actionsFor(row, me.value)

const modalOpen = ref(false)
const modalRecord = ref<Record<string, unknown> | null>(null)

function changeStatus(event: Event) {
  status.value = Number((event.target as HTMLSelectElement).value) as RequestStatus
  void reload()
}

async function viewRecord(row: DeletionRequestRow) {
  showLoader('loading details...')
  try {
    const view = await requestApi.record(row.id)
    hideLoader()
    if (!view.record) {
      await swalNotification('error', 'Oops, record not found!')
      return
    }
    modalRecord.value = view.record
    modalOpen.value = true
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'The record could not be loaded. Please try again.'))
  }
}

async function decide(row: DeletionRequestRow, approve: boolean) {
  const dialog = approve ? swalDelete : swalConfirm
  const answer = await dialog.fire({
    icon: 'warning',
    html: approve ? APPROVE_TEXT : CANCEL_TEXT,
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed!',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('processing, please wait...')
  try {
    const result = await (approve ? requestApi.approve(row.id) : requestApi.cancel(row.id))
    hideLoader()
    await swalNotification('success', result.message)
    await reload()
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'The request could not be actioned. Please try again.'))
    // somebody else may have decided it meanwhile: show what the list says now
    if (axios.isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 409)) await reload()
  }
}
</script>

<template>
  <section class="px-2">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
        <span class="text-ink">Requests</span>
      </nav>
      <div class="ml-auto flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="search"
          placeholder="search..."
          class="form-input w-64"
          aria-label="Search requests"
          data-testid="search"
        />
        <label class="flex">
          <span class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            >Filter</span
          >
          <select
            class="form-input rounded-l-none"
            aria-label="Filter by status"
            data-testid="status"
            :value="status"
            @change="changeStatus"
          >
            <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm" data-testid="requests">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Record</th>
            <th class="px-4 py-3">Requesting User</th>
            <th class="px-4 py-3">Date Requested</th>
            <th class="px-4 py-3">Comment</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in items"
            :key="r.id"
            class="border-t border-slate-100 align-top hover:bg-[#F7FAFC]"
            :data-testid="`request-${r.id}`"
          >
            <td class="px-4 py-3">
              <span data-testid="request-id">{{ r.request_id }}</span>
              <template v-if="r.request_status === 0">
                <br />
                <span
                  class="mt-1 inline-block rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800"
                  data-testid="pending-badge"
                  >Pending Approval</span
                >
              </template>
            </td>
            <td class="px-4 py-3">
              <small class="block max-w-xs text-muted" data-testid="record-label">{{ recordText(r) }}</small>
              <a href="#" class="text-primary-1" data-testid="view" @click.prevent="viewRecord(r)">View</a>
            </td>
            <td class="px-4 py-3">{{ r.requested_by_name }}</td>
            <td class="whitespace-nowrap px-4 py-3">{{ requestedOn(r.requested_at) }}</td>
            <td class="w-[300px] max-w-[300px] whitespace-normal break-words px-4 py-3">
              {{ r.request_comment }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <template v-if="r.request_status === 0">
                <button
                  v-if="actions(r).approve"
                  type="button"
                  class="rounded bg-danger px-3 py-1 text-xs font-medium text-white"
                  data-testid="approve"
                  @click="decide(r, true)"
                >
                  Accept &amp; Delete
                </button>
                <button
                  v-if="actions(r).cancel"
                  type="button"
                  class="ml-2 rounded bg-success px-3 py-1 text-xs font-medium text-white"
                  data-testid="cancel"
                  @click="decide(r, false)"
                >
                  Decline &amp; Maintain
                </button>
                <small
                  v-if="!actions(r).approve && !actions(r).cancel"
                  class="text-muted"
                  data-testid="waiting"
                  >Waiting for another user to decide</small
                >
              </template>
              <template v-else-if="r.request_status === 1">
                <span class="rounded bg-success px-2 py-0.5 text-xs text-white" data-testid="approved-badge"
                  >Request Approved</span
                >
                <br />
                <small class="text-danger">(Record was deleted)</small>
              </template>
              <template v-else>
                <span
                  class="rounded bg-amber-400 px-2 py-0.5 text-xs text-slate-900"
                  data-testid="canceled-badge"
                  >Request Canceled</span
                >
                <br />
                <small class="text-success">(Record retained)</small>
              </template>
              <small
                v-if="r.request_status !== 0 && r.actioned_by_name"
                class="mt-1 block text-muted"
                data-testid="actioned"
                >by {{ r.actioned_by_name }}, {{ requestedOn(r.actioned_at) }}</small
              >
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="error" class="px-4 py-3 text-sm text-danger" data-testid="load-error">
        Failed to load requests. Please refresh and try again.
      </p>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0 && !error"
      empty-text="No requests found."
      @load="loadMore"
    />
    <RecordModal v-model:open="modalOpen" :record="modalRecord" />
  </section>
</template>
