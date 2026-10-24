<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import { contractDateText, money } from './analysisModel'
import type { LoanWithoutRow } from './types'

/** /reports/loans-without-cmc-bs-ccg: loan accounts that have no collateral, guarantor or stakeholder record (LoansWithoutCmcCcgBs.vue). */
const { items, search, loading, completed, loadMore } = useCollection<LoanWithoutRow>(
  '/reports/loans-without-cmc-ccg-bs',
)
onMounted(loadMore)
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Loans Without CMC, CCG, BS
      </nav>
      <input
        v-model="search"
        type="text"
        placeholder="search..."
        class="form-input ml-auto w-64"
        aria-label="Search contract code"
      />
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Contract Date</th>
            <th class="px-4 py-3">Amount</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="l in items"
            :key="l.id"
            class="border-t border-slate-100 hover:bg-[#F7FAFC]"
            data-testid="loan-row"
          >
            <td class="px-4 py-3">
              {{ l.contractCode }}<br />
              <span class="text-muted">{{ l.name }}</span
              ><br />
              <span class="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{{ l.lackFactor }}</span>
            </td>
            <td class="px-4 py-3">{{ contractDateText(l.contractDate) }}</td>
            <td class="px-4 py-3">{{ l.currency }} {{ money(l.creditAmount) }}</td>
            <td class="px-4 py-3 text-right">
              <RouterLink
                :to="`/loans/show/${l.loan_id}`"
                class="text-primary-1"
                :aria-label="`Open ${l.contractCode}`"
                >👁</RouterLink
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No results :("
      @load="loadMore"
    />
  </section>
</template>
