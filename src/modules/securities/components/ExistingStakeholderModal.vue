<script setup lang="ts">
import { watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import type { StakeholderRow } from '../types'

/**
 * "Existing Stakeholder" (#getStakeholdersModal): the stakeholders of this borrower, to pick one of them as a guarantor.
 * `borrower` is the borrower's client number.
 */
const props = defineProps<{ borrower: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [row: StakeholderRow] }>()

const { items, search, queryFilter, loading, completed, loadMore, reload } =
  useCollection<StakeholderRow>('/stakeholders')
watch(open, (isOpen) => {
  if (isOpen) {
    search.value = null
    queryFilter.value = props.borrower
    void reload()
  }
})

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))
const holding = (r: StakeholderRow) =>
  `${r.category_name ?? ''}${r.ShareholderPercentage ? ` [${r.ShareholderPercentage}%]` : ''}`.trim() || '-'
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-12 z-50 flex max-h-[80vh] w-[min(70rem,96vw)] -translate-x-1/2 flex-col rounded bg-white shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <div class="border-b border-slate-200 p-4">
          <DialogTitle class="mb-3 text-base font-semibold uppercase tracking-wide text-project"
            >Existing Stakeholder</DialogTitle
          >
          <input
            v-model="search"
            type="text"
            placeholder="Search Stakeholders"
            class="form-input"
            aria-label="Search stakeholders"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto" style="max-height: 500px">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-4 py-3">Stakeholder</th>
                <th class="px-4 py-3">Client No</th>
                <th class="px-4 py-3">FCS No</th>
                <th class="px-4 py-3">Classification</th>
                <th class="px-4 py-3">Shareholding</th>
                <th class="px-4 py-3">Borrower</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in items" :key="r.id" class="border-t border-slate-100">
                <td class="px-4 py-2">{{ dash(r.stakeholder_profile?.full_name.trim()) }}</td>
                <td class="px-4 py-2">{{ dash(r.stakeholder_profile?.clientNumber) }}</td>
                <td class="px-4 py-2">{{ dash(r.stakeholder_profile?.II_FCSNumber) }}</td>
                <td class="px-4 py-2">{{ dash(r.stakeholder_profile?.customer_type) }}</td>
                <td class="px-4 py-2">{{ holding(r) }}</td>
                <td class="px-4 py-2">{{ dash(r.borrower?.full_name.trim()) }}</td>
                <td class="px-4 py-2 text-right">
                  <button type="button" class="btn-outline" @click="emit('select', r)">Select</button>
                </td>
              </tr>
            </tbody>
          </table>
          <InfiniteScroll
            :loading="loading"
            :completed="completed"
            :is-empty="items.length === 0"
            empty-text="No stakeholders found."
            @load="loadMore"
          />
        </div>
        <div class="flex justify-end border-t border-slate-200 p-3">
          <DialogClose class="rounded bg-danger px-4 py-2 text-sm font-medium text-white" type="button"
            >Close</DialogClose
          >
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
