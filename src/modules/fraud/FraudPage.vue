<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { messageOf } from '@/api/http'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import type { CustomerRow } from '@/modules/customer/types'
import ExistingCustomerModal from '@/modules/institution/components/ExistingCustomerModal.vue'
import { institutionApi } from '@/modules/institution/api'
import { useAuthStore } from '@/stores/auth'
import { swalNotification } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import FraudDialog from './components/FraudDialog.vue'
import { fraudFormFrom, newFraudForm, type FraudForm } from './fraudModel'
import type { FraudRecord } from './types'

/** /fraud: financial malpractice records, with Register Fraud and edit (fra/index.blade.php + FRA/Index.vue). */
const auth = useAuthStore()
const { items, loading, completed, loadMore, reload } = useCollection<FraudRecord>('/fraud')
const pickerOpen = ref(false)
const dialogOpen = ref(false)
const form = ref<FraudForm | null>(null)
const editingId = ref<number | null>(null)
const picking = ref(false)

onMounted(loadMore)

async function chosen(row: CustomerRow) {
  if (picking.value) return
  picking.value = true
  try {
    const customer = await institutionApi.profileByCif(row.clientNumber)
    if (!customer) return void swalNotification('error', 'Unknown Profile')
    pickerOpen.value = false
    // let the picker finish closing first: two modals changing the page's aria-hidden at once leave it hidden
    await nextTick()
    form.value = newFraudForm(customer)
    editingId.value = null
    dialogOpen.value = true
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The profile could not be loaded.'))
  } finally {
    picking.value = false
  }
}

function edit(record: FraudRecord) {
  form.value = fraudFormFrom(record)
  editingId.value = record.id
  dialogOpen.value = true
}

async function saved() {
  await reload()
  await swalNotification('success', 'FRA Saved Successfully')
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Fraud
      </nav>
      <button
        v-if="auth.has('Create FRA')"
        type="button"
        class="btn-primary-1 ml-auto"
        @click="pickerOpen = true"
      >
        Register Fraud
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Names</th>
            <th class="px-4 py-3">Client Number</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3">Incident Date</th>
            <th class="px-4 py-3">Savings Amount</th>
            <th class="px-4 py-3">Loss Amount</th>
            <th class="px-4 py-3">Currency</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in items" :key="f.id" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
            <td class="px-4 py-3">{{ f.customer?.full_name.trim() }}</td>
            <td class="px-4 py-3">{{ f.clientNumber }}</td>
            <td class="px-4 py-3">{{ f.category_name }}</td>
            <td class="px-4 py-3">{{ f.IncidentDate }}</td>
            <td class="px-4 py-3">{{ formatNumber(f.SavingsAmount) }}</td>
            <td class="px-4 py-3">{{ formatNumber(f.LossAmount) }}</td>
            <td class="px-4 py-3">{{ f.currency }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="auth.has('Update FRA')"
                type="button"
                class="text-primary-1"
                :aria-label="`Edit ${f.clientNumber}`"
                @click="edit(f)"
              >
                ✎
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
      empty-text="No results found."
      @load="loadMore"
    />
    <ExistingCustomerModal v-model:open="pickerOpen" action-label="Select" @select="chosen" />
    <FraudDialog v-model:open="dialogOpen" :form="form" :editing-id="editingId" @saved="saved" />
  </section>
</template>
