<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { formatNumber } from '@/utils/format'
import type { BouncedCheque } from './types'

/** /bc-list: bounced cheques, newest upload first (bc/index.blade.php + BcIndex.vue). */
const { items, loading, completed, loadMore } = useCollection<BouncedCheque>('/bounced-cheques')
onMounted(loadMore)
</script>

<template>
  <section>
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / BC
    </nav>
    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Customer</th>
            <th class="px-4 py-3">Client Number</th>
            <th class="px-4 py-3">Cheque Number</th>
            <th class="px-4 py-3">Amount</th>
            <th class="px-4 py-3">FCS Number</th>
            <th class="px-4 py-3">Bounce Date</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="c in items" :key="c.id">
            <tr v-if="c.customer" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
              <td class="max-w-[300px] px-4 py-3">
                <RouterLink :to="`/borrowers/edit/${c.customer.id}`" class="font-medium text-project">{{
                  c.customer.full_name.trim() || 'Unnamed customer'
                }}</RouterLink>
              </td>
              <td class="px-4 py-3">{{ c.clientNumber }}</td>
              <td class="px-4 py-3">{{ c.ChequeNumber }}</td>
              <td class="px-4 py-3">{{ c.ChequeCurrency }} {{ formatNumber(c.ChequeAmount) }}</td>
              <td class="px-4 py-3">{{ c.customer.II_FCSNumber }}</td>
              <td class="px-4 py-3">{{ c.ChequeBounceDate }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No results found."
      @load="loadMore"
    />
  </section>
</template>
