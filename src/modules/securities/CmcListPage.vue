<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import { useAuthStore } from '@/stores/auth'
import { formatNumber } from '@/utils/format'
import CollateralModal from './components/CollateralModal.vue'
import MapInstrumentsModal from './components/MapInstrumentsModal.vue'
import type { CollateralRow } from './types'

/**
 * /cmc-list: collateral of every borrower (cmc/index.blade.php + CmcIndex.vue). Collateral is added from a credit application or loan
 * page, so this list only edits. Deleting goes through a deletion request (milestone 7) and is not offered yet; a record that already
 * has a pending request shows the red flag.
 */
const auth = useAuthStore()
const { items, search, loading, completed, error, loadMore, reload } =
  useCollection<CollateralRow>('/collaterals')
onMounted(loadMore)

const editing = ref(false)
const selected = ref<CollateralRow | null>(null)
const mapping = ref(false)

function edit(c: CollateralRow) {
  selected.value = c
  editing.value = true
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CMC
      </nav>
      <input
        v-model="search"
        type="text"
        placeholder="search..."
        class="form-input ml-auto w-64"
        aria-label="Search collateral"
      />
      <button
        v-if="auth.has('Update Collateral')"
        type="button"
        class="btn-primary-1"
        @click="mapping = true"
      >
        Map Instruments Of Claim
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Collateral Type</th>
            <th class="px-4 py-3">REF NO.</th>
            <th class="px-4 py-3">Market Value</th>
            <th class="px-4 py-3">Instruments Of Claim</th>
            <th class="px-4 py-3">Borrower Details</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in items" :key="c.id" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
            <td class="px-4 py-3">
              <button
                v-if="auth.has('Update Collateral') && !c.is_deleted"
                type="button"
                class="text-primary-1 hover:underline"
                @click="edit(c)"
              >
                {{ c.cmc_type || c.CollateralType }}
              </button>
              <template v-else>{{ c.cmc_type || c.CollateralType }}</template>
            </td>
            <td class="px-4 py-3">{{ c.CollateralReferenceNumber }}</td>
            <td class="px-4 py-3">
              {{ c.CollateralCurrency }} {{ formatNumber(c.CollateralOpenMarketValue) }}
            </td>
            <td class="px-4 py-3">{{ c.InstrumentofClaim }}</td>
            <td class="max-w-[200px] px-4 py-3 text-slate-500">
              <RouterLink v-if="c.customer" :to="`/borrowers/${c.customer.id}`" class="text-project">
                {{ c.customer.full_name.trim() || 'Unnamed customer' }}
              </RouterLink>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-3 text-right">
              <span
                v-if="c.is_deleted"
                class="text-danger"
                title="This record has been requested to be deleted!"
                role="img"
                aria-label="Deletion requested"
                >⚑</span
              >
              <button
                v-else-if="auth.has('Update Collateral')"
                type="button"
                class="text-slate-500 hover:text-project"
                :aria-label="`Edit ${c.CollateralReferenceNumber}`"
                @click="edit(c)"
              >
                ✎
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="py-4 text-center text-sm text-danger">
      Failed to load collateral. Please refresh and try again.
    </p>
    <InfiniteScroll
      v-else
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No collateral found."
      @load="loadMore"
    />

    <CollateralModal v-model:open="editing" :collateral="selected" @saved="reload()" />
    <MapInstrumentsModal v-model:open="mapping" @mapped="reload()" />
  </section>
</template>
