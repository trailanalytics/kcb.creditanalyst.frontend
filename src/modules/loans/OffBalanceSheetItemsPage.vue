<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import axios from 'axios'
import { RouterLink } from 'vue-router'
import { messageOf, problemOf } from '@/api/http'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useAuthStore } from '@/stores/auth'
import { hideLoader, showLoader, swalConfirm, swalDelete, swalNotification } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import { loansApi } from './api'
import { errorLines, filledClients } from './loanModel'
import type { OffBalanceItem } from './types'

/** /off-balance-sheet/items: items from the daily extract that still need a client number (OffBalanceSheet/Items.vue). */
const auth = useAuthStore()
const { items, search, queryFilter, loading, completed, loadMore, reload, changeFilter } =
  useCollection<OffBalanceItem>('/off-balance-sheet-items')
const clients = reactive<Record<number, string>>({})
const start = ref('')
const end = ref('')
onMounted(loadMore)

const shortDate = (v: string | null) => (v && dayjs(v).isValid() ? dayjs(v).format('D, MMM YYYY') : '')

/** Apply Filter: both dates empty does nothing, unless a filter is on, which it then clears. */
function applyFilter() {
  if (!start.value && !end.value) {
    if (queryFilter.value) changeFilter('')
    return
  }
  changeFilter(`${start.value},${end.value}`)
}

async function save() {
  const entries = filledClients(clients)
  if (!entries.length)
    return void swalNotification(
      'error',
      'Please fill in a client number for at least 1 off balance sheet item and try again!',
    )
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'You are about to update the client numbers of these off balance sheet items. Items with matching client numbers will be added to the CBA! Proceed?',
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed!',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('updating, please wait...')
  try {
    const result = await loansApi.saveOffBalance(entries)
    hideLoader()
    await swalNotification(
      result.not_found.length || result.missing_items.length ? 'warning' : 'success',
      result.message,
    )
    Object.keys(clients).forEach((k) => delete clients[Number(k)])
    await reload()
  } catch (e) {
    hideLoader()
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
      await swalNotification('error', errorLines(problem.errors).join('<br>'))
    else await swalNotification('error', messageOf(e))
  }
}

async function remove(item: OffBalanceItem) {
  const answer = await swalDelete.fire({
    icon: 'warning',
    text: 'You are about to delete this off balance sheet item. This action can not be undone! Proceed?',
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed!',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('updating, please wait...')
  try {
    const result = await loansApi.deleteOffBalance(item.id)
    hideLoader()
    await swalNotification('success', result.message)
    delete clients[item.id]
    await reload()
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e))
  }
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
        <RouterLink to="/analysis" class="text-primary-1">Analysis</RouterLink> / Off Balance Sheet Items
      </nav>
      <div class="ml-auto flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="text"
          placeholder="search by contractCode"
          class="form-input w-56"
          aria-label="Search by contract code"
        />
        <div class="flex items-center gap-2">
          <input v-model="start" type="date" class="form-input w-40" aria-label="Start date" />
          <input v-model="end" type="date" class="form-input w-40" aria-label="End date" />
          <button type="button" class="btn-primary-1" @click="applyFilter">Apply Filter</button>
        </div>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-muted">
          <tr>
            <th class="px-4 py-2">Client Number</th>
            <th class="px-4 py-2">Customer Name</th>
            <th class="px-4 py-2">Type</th>
            <th class="px-4 py-2">Amount</th>
            <th class="px-4 py-2">Contract Date</th>
            <th class="px-4 py-2">Maturity Date</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="border-t border-slate-100" data-testid="item-row">
            <td class="px-4 py-2">
              <input
                v-model="clients[item.id]"
                type="text"
                class="form-input w-44"
                placeholder="client number"
                :aria-label="`Client number for ${item.contractCode}`"
              />
            </td>
            <td class="px-4 py-2">{{ item.customerName }}</td>
            <td class="px-4 py-2">{{ item.contractType }}</td>
            <td class="px-4 py-2">{{ formatNumber(item.amount) }}</td>
            <td class="px-4 py-2">{{ shortDate(item.contractDate) }}</td>
            <td class="px-4 py-2">{{ shortDate(item.maturityDate) }}</td>
            <td class="px-4 py-2 text-right">
              <button
                v-if="auth.has('Delete Off Balance Sheet Items')"
                type="button"
                class="text-danger"
                :aria-label="`Delete ${item.contractCode}`"
                @click="remove(item)"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No off balance sheet items are waiting for a client number."
      @load="loadMore"
    />
    <div v-if="items.length && auth.has('Update Off Balance Sheet Items')" class="mt-4">
      <button type="button" class="btn-primary-1" @click="save">Save Changes</button>
    </div>
  </section>
</template>
