<script setup lang="ts">
import { watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import type { CustomerRow } from '@/modules/customer/types'

/**
 * The "existing customer" picker (existing_customer_modal.blade.php): search every customer, newest first, and hand the chosen
 * one to the page. The action is "Select" on the fraud page and "Use" on the PI stakeholder page.
 */
withDefaults(defineProps<{ actionLabel?: string }>(), { actionLabel: 'Select' })
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [customer: CustomerRow] }>()

const { items, search, loading, completed, loadMore, reload } =
  useCollection<CustomerRow>('/borrowers/customers')

// every opening starts from page 1 of an empty search
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    search.value = null
    void reload()
  },
  { immediate: true },
)
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-16 z-50 w-[min(60rem,94vw)] -translate-x-1/2 rounded bg-white shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <DialogTitle class="sr-only">Existing customer</DialogTitle>
        <div class="max-h-[500px] overflow-y-auto p-4" data-testid="customer-list">
          <div class="mb-3 md:w-7/12">
            <input
              v-model="search"
              type="text"
              placeholder="Search Customers"
              class="form-input"
              aria-label="Search Customers"
            />
          </div>
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-3 py-2">Borrower</th>
                <th class="px-3 py-2">Client No</th>
                <th class="px-3 py-2">FCS No</th>
                <th class="px-3 py-2">Classification</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in items" :key="c.id" class="border-t border-slate-100">
                <td class="px-3 py-2">{{ c.full_name.trim() || 'Unnamed customer' }}</td>
                <td class="px-3 py-2">{{ c.clientNumber }}</td>
                <td class="px-3 py-2">{{ c.II_FCSNumber }}</td>
                <td class="px-3 py-2">
                  {{ c.classificationCode === '0' ? 'Individual' : 'Non Individual' }}
                </td>
                <td class="px-3 py-2 text-right">
                  <button type="button" class="btn-outline !py-1" @click="emit('select', c)">
                    {{ actionLabel }}
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
        <div class="flex justify-end border-t border-slate-200 px-4 py-3">
          <DialogClose class="btn-primary-1 !bg-danger">Close</DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
