<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useAuthStore } from '@/stores/auth'
import { formatNumber } from '@/utils/format'
import { statusClass, statusText } from '../loanModel'
import type { LoanRow } from '../types'

/**
 * The loan list shared by /loans, /write-offs, /ignored-accounts and /force-closed-accounts (LoanIndex.vue): a search box,
 * rows of 50 loaded as the page scrolls, and a hover area with the actions the page puts in the `actions` slot.
 */
const props = withDefaults(
  defineProps<{
    url: string
    /** Colour of the borrower's name (red on the ignored list, green on the force-closed list). */
    nameClass?: string
    /** `writeoff` shows the current balance column and the contract date under the amount. */
    variant?: 'loan' | 'writeoff'
  }>(),
  { nameClass: 'text-project', variant: 'loan' },
)

const auth = useAuthStore()
const { items, search, loading, completed, loadMore, reload } = useCollection<LoanRow>(props.url)
onMounted(loadMore)
defineExpose({ reload })

const columns = (v: string) =>
  v === 'writeoff'
    ? 'md:grid-cols-[50px_minmax(0,4fr)_minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)]'
    : 'md:grid-cols-[50px_minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]'
const nameOf = (l: LoanRow) => l.customer?.full_name.trim() || 'Unnamed customer'
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted"><slot name="breadcrumb" /></nav>
      <div class="ml-auto flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="text"
          placeholder="search..."
          class="form-input w-64"
          aria-label="Search loans"
        />
        <slot name="toolbar" />
      </div>
    </div>

    <div class="card">
      <div
        v-for="l in items"
        :key="l.id"
        class="group relative border-b border-slate-100 p-4 last:border-0 hover:bg-[#F7FAFC]"
        data-testid="loan-row"
      >
        <div class="grid items-center gap-4" :class="columns(variant)">
          <img src="/img/profile-placeholder.jpg" alt="" width="50" class="rounded" />
          <div class="min-w-0 text-sm">
            <RouterLink
              v-if="l.customer && auth.has('View Profiles')"
              :to="`/borrowers/${l.customer.id}`"
              class="font-medium"
              :class="nameClass"
              >{{ nameOf(l) }}</RouterLink
            >
            <span v-else class="font-medium" :class="nameClass">{{ nameOf(l) }}</span>
            <small class="block text-muted">{{ l.contractCode }}</small>
          </div>
          <template v-if="variant === 'writeoff'">
            <div class="text-sm">
              {{ l.currency }} {{ formatNumber(l.creditAmount)
              }}<small class="block text-muted">{{ l.contractDate }}</small>
            </div>
            <div class="text-sm">{{ l.loan_type }}<small class="block text-muted">Type</small></div>
            <div class="text-sm">
              {{ l.maturityDate }}<small class="block text-muted">Maturity Date</small>
            </div>
            <div class="text-sm">
              {{ l.currency }} {{ formatNumber(l.currentBalanceAmount)
              }}<small class="block text-muted">Current Balance</small>
            </div>
          </template>
          <template v-else>
            <div class="text-sm">
              {{ l.contractDate }}<small class="block text-muted">Contract Date</small>
            </div>
            <div class="text-sm">
              {{ l.currency }} {{ formatNumber(l.creditAmount)
              }}<small class="block text-muted">Amount</small>
            </div>
            <div class="text-sm">{{ l.loan_type }}<small class="block text-muted">Type</small></div>
            <div class="text-sm">
              {{ l.maturityDate }}<small class="block text-muted">Maturity Date</small>
            </div>
          </template>
          <div class="text-sm">
            <span :class="statusClass(l.creditAccountStatus)">{{ statusText(l.creditAccountStatus) }}</span>
            <small class="block text-muted">Status</small>
          </div>
        </div>
        <div
          class="absolute right-[4%] top-1/2 hidden -translate-y-1/2 group-hover:flex group-focus-within:flex"
        >
          <slot name="actions" :loan="l">
            <RouterLink :to="`/loans/show/${l.id}`" class="btn-outline">Loan Details</RouterLink>
          </slot>
        </div>
      </div>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No results"
      @load="loadMore"
    />
  </section>
</template>
