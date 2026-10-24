<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { requestDeletion } from '@/modules/requests/deletionFlow'
import { useAuthStore } from '@/stores/auth'
import { formatNumber } from '@/utils/format'
import { statusLabel, termText } from './loanModel'
import type { Application } from './types'

/** /applications: the CAP list (cap/index.blade.php + CapIndex.vue). */
const auth = useAuthStore()
const { items, search, queryFilter, loading, completed, loadMore, changeFilter, updateItem } =
  useCollection<Application>('/applications')
onMounted(loadMore)

async function remove(a: Application) {
  if (await requestDeletion('application', a.id)) updateItem({ id: a.id, is_deleted: true })
}

const statusClass = (s: string | null) =>
  s === '2' ? 'text-amber-600' : s === '0' ? 'text-success' : 'text-danger'
const idLabel = (a: Application) =>
  a.customer?.classificationCode === '1'
    ? ['Reg No', a.customer.non_individual_details?.II_RegistrationCertificateNumber]
    : ['NIN', a.customer?.individual_details?.II_CountryID]
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Credit Applications
      </nav>
      <input
        v-model="search"
        type="text"
        placeholder="search..."
        class="form-input ml-auto w-64"
        aria-label="Search applications"
      />
      <label class="flex items-center gap-2 text-sm">
        Filter
        <select
          :value="queryFilter"
          class="form-input w-36"
          aria-label="Filter applications"
          @change="changeFilter(($event.target as HTMLSelectElement).value)"
        >
          <option value="">All</option>
          <option value="2">Pending</option>
          <option value="0">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="joint">Joint</option>
        </select>
      </label>
    </div>

    <div class="card">
      <div
        v-for="a in items"
        :key="a.id"
        class="group relative border-b border-slate-100 p-4 last:border-0 hover:bg-[#F7FAFC]"
      >
        <div class="grid items-center gap-4 md:grid-cols-[50px_minmax(0,4fr)_repeat(4,minmax(0,2fr))]">
          <img src="/img/profile-placeholder.jpg" alt="" width="50" class="rounded" />
          <div class="min-w-0 text-sm">
            <div>
              <RouterLink
                v-if="a.customer"
                :to="`/borrowers/${a.customer.id}`"
                class="font-medium text-project"
                >{{ a.customer.full_name.trim() || 'Unnamed customer' }}</RouterLink
              >
              <span v-if="a.customer" class="ml-1 text-xs text-muted">({{ a.customer.customer_type }})</span>
            </div>
            <div>
              <b>Client No:</b> {{ a.clientNumber }} | <b>{{ idLabel(a)[0] }}:</b>
              {{ idLabel(a)[1] || 'N/A' }}
            </div>
            <div><b>CAP Ref:</b> {{ a.creditApplicationReference }}</div>
            <div v-if="a.jointAccountNumber" class="text-xs text-muted">
              Joint Account: ({{ a.jointAccountNumber }})
            </div>
          </div>
          <div class="text-sm">
            {{ a.currency }} {{ formatNumber(a.Amount) }}<small class="block text-muted">Amount</small>
          </div>
          <div class="text-sm">
            {{ termText(a.Term, a.TermPeriod) }}<small class="block text-muted">Term</small>
          </div>
          <div class="text-sm">{{ a.creditApplicationDate }}<small class="block text-muted">Date</small></div>
          <div class="text-sm">
            <span :class="statusClass(a.creditApplicationStatus)">{{
              statusLabel(a.creditApplicationStatus)
            }}</span>
            <small class="block text-muted">Status</small>
          </div>
        </div>
        <div
          class="absolute right-[4%] top-1/2 hidden -translate-y-1/2 group-hover:flex group-focus-within:flex"
        >
          <span v-if="a.is_deleted" class="text-danger" title="This record has been requested to be deleted!"
            >⚑</span
          >
          <div v-else class="flex">
            <RouterLink :to="`/applications/show/${a.id}`" class="btn-outline rounded-r-none"
              >Loan Details</RouterLink
            >
            <DropdownMenuRoot>
              <DropdownMenuTrigger class="btn-outline rounded-l-none border-l-0" aria-label="More actions"
                >▾</DropdownMenuTrigger
              >
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  class="z-50 min-w-40 rounded border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <DropdownMenuItem as-child>
                    <RouterLink
                      :to="`/applications/change-status/${a.id}`"
                      class="block px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100"
                      >Approve Loan</RouterLink
                    >
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <RouterLink
                      :to="`/applications/change-status/${a.id}`"
                      class="block px-4 py-2 text-sm text-danger outline-none data-[highlighted]:bg-slate-100"
                      >Reject Loan</RouterLink
                    >
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <RouterLink
                      :to="`/applications/edit/${a.id}`"
                      class="block px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100"
                      >Edit Loan</RouterLink
                    >
                  </DropdownMenuItem>
                  <template v-if="auth.has('Delete Applications')">
                    <DropdownMenuSeparator class="my-1 h-px bg-slate-200" />
                    <DropdownMenuItem
                      class="block cursor-pointer px-4 py-2 text-sm text-danger outline-none data-[highlighted]:bg-slate-100"
                      @select="remove(a)"
                      >Delete Loan</DropdownMenuItem
                    >
                  </template>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </div>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text=""
      @load="loadMore"
    />
  </section>
</template>
