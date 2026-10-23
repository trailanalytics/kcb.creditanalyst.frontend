<script setup lang="ts">
import { watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import type { Customer, CustomerRow } from '@/modules/customer/types'

/** "Existing Customer" (#getCustomersModal): search every customer and pick one to use as the guarantor or stakeholder. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [customer: Customer] }>()

const { items, search, loading, completed, loadMore, reload } =
  useCollection<CustomerRow>('/borrowers/customers')
watch(open, (isOpen) => {
  if (isOpen) {
    search.value = null
    void reload()
  }
})

const classification = (c: CustomerRow) => (c.classificationCode === '1' ? 'Non Individual' : 'Individual')
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-12 z-50 flex max-h-[80vh] w-[min(64rem,96vw)] -translate-x-1/2 flex-col rounded bg-white shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <div class="border-b border-slate-200 p-4">
          <DialogTitle class="mb-3 text-base font-semibold uppercase tracking-wide text-project"
            >Existing Customer</DialogTitle
          >
          <input
            v-model="search"
            type="text"
            placeholder="Search Customers"
            class="form-input"
            aria-label="Search customers"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto" style="max-height: 500px">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-4 py-3">Borrower</th>
                <th class="px-4 py-3">Client No</th>
                <th class="px-4 py-3">FCS No</th>
                <th class="px-4 py-3">Classification</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" class="border-t border-slate-100">
                <td class="px-4 py-2">{{ c.full_name.trim() || 'Unnamed customer' }}</td>
                <td class="px-4 py-2">{{ c.clientNumber }}</td>
                <td class="px-4 py-2">{{ c.II_FCSNumber }}</td>
                <td class="px-4 py-2">{{ classification(c) }}</td>
                <td class="px-4 py-2 text-right">
                  <button type="button" class="btn-outline" @click="emit('select', c as unknown as Customer)">
                    Select
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <InfiniteScroll
            :loading="loading"
            :completed="completed"
            :is-empty="items.length === 0"
            empty-text="No customers found."
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
