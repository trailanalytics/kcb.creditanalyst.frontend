<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import type { CustomerRow } from '@/modules/customer/types'
import { useAuthStore } from '@/stores/auth'
import { useReferenceStore } from '@/stores/reference'
import ExistingCustomerModal from './components/ExistingCustomerModal.vue'
import type { Stakeholder } from './types'

/** /pis: the participating institution's stakeholders (pis/index.blade.php + PisIndex.vue). */
const auth = useAuthStore()
const reference = useReferenceStore()
const router = useRouter()
const { items, loading, completed, loadMore } = useCollection<Stakeholder>('/pi-stakeholders')
const pickerOpen = ref(false)

onMounted(() => {
  void reference.load('stakeholder-categories')
  void loadMore()
})

function useProfile(customer: CustomerRow) {
  pickerOpen.value = false
  void router.push({ path: '/proflie/new/pis', query: { profile: customer.clientNumber } })
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / PIS
      </nav>
      <div class="ml-auto">
        <DropdownMenuRoot>
          <DropdownMenuTrigger class="btn-primary-1">New PIS ▾</DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              class="z-50 min-w-44 rounded border border-slate-200 bg-white py-1 shadow-lg"
            >
              <DropdownMenuItem
                class="block cursor-pointer px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100"
                @select="pickerOpen = true"
                >Existing Profile</DropdownMenuItem
              >
              <DropdownMenuItem as-child>
                <RouterLink
                  to="/proflie/new/pis"
                  class="block px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100"
                  >New Profile</RouterLink
                >
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Names</th>
            <th class="px-4 py-3">Client Number</th>
            <th class="px-4 py-3">FCS Number</th>
            <th class="px-4 py-3">Classification</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3">Shareholder Percentage</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in items" :key="s.id" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
            <td class="px-4 py-3">{{ s.customer?.full_name.trim() }}</td>
            <td class="px-4 py-3">{{ s.clientNumber }}</td>
            <td class="px-4 py-3">{{ s.customer?.II_FCSNumber }}</td>
            <td class="px-4 py-3">{{ s.customer?.customer_type }}</td>
            <td class="px-4 py-3">{{ reference.label('stakeholder-categories', s.StakeholderCategory) }}</td>
            <td class="px-4 py-3">{{ s.ShareholderPercentage }} %</td>
            <td class="px-4 py-3 text-right">
              <span
                v-if="s.is_deleted"
                class="text-danger"
                title="This record has been requested to be deleted!"
                >⚑</span
              >
              <RouterLink
                v-else-if="auth.has('Update PIS')"
                :to="`/edit/pis/${s.id}`"
                class="text-primary-1"
                :aria-label="`Edit ${s.clientNumber}`"
                >✎</RouterLink
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
      empty-text="No results found."
      @load="loadMore"
    />
    <ExistingCustomerModal v-model:open="pickerOpen" action-label="Use" @select="useProfile" />
  </section>
</template>
