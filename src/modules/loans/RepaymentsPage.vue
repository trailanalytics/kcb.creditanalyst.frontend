<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import LoanHeaderCard from './components/LoanHeaderCard.vue'
import type { LoanView } from './types'

/** /loans/repayments/{id}: the loan's repayments from the extract, newest first (cba/repayments.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const view = ref<LoanView | null>(null)

onMounted(async () => {
  try {
    view.value = await loansApi.repayments(props.id)
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The repayments could not be loaded.'))
    await router.replace('/loans')
  }
})
</script>

<template>
  <section v-if="view" class="mx-auto max-w-6xl">
    <LoanHeaderCard :view="view" />
    <div class="mb-3 flex items-center gap-3">
      <h2 class="text-lg font-semibold text-project">
        {{ view.customer.full_name.trim() || 'Unnamed customer' }}'s Repayments for Account
        {{ view.loan.contractCode }}
      </h2>
      <span class="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs" data-testid="repayment-count">{{
        view.repayments?.length ?? 0
      }}</span>
    </div>
    <div v-if="view.repayments?.length" class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-muted">
          <tr>
            <th class="px-4 py-2">#</th>
            <th class="px-4 py-2">Payment Date</th>
            <th class="px-4 py-2">Payment Amount</th>
            <th class="px-4 py-2">Last Status Change Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in view.repayments" :key="r.no" class="border-t border-slate-100">
            <td class="px-4 py-2">{{ r.no }}</td>
            <td class="px-4 py-2">{{ r.paymentDate }}</td>
            <td class="px-4 py-2">{{ r.paymentAmount }}</td>
            <td class="px-4 py-2">{{ r.lastStatusChangeDate }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-else
      class="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
      role="status"
    >
      No repayments found at the moment!
    </div>
  </section>
</template>
