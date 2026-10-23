<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import LoanHeaderCard from './components/LoanHeaderCard.vue'
import SecurityActions from '@/modules/securities/components/SecurityActions.vue'
import SecurityPanels from '@/modules/securities/components/SecurityPanels.vue'
import type { LoanView } from './types'

/** /loans/show/{id}: header with the key facts and the collapsible "Full Loan Details" (cba/show.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const view = ref<LoanView | null>(null)
const showAll = ref(false)

onMounted(async () => {
  try {
    view.value = await loansApi.view(props.id)
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The loan could not be loaded.'))
    await router.replace('/loans')
  }
})
</script>

<template>
  <section v-if="view" class="mx-auto max-w-6xl">
    <LoanHeaderCard :view="view">
      <template #actions>
        <RouterLink :to="`/loans/repayments/${view.loan.id}`" class="btn-outline">Repayments</RouterLink>
        <SecurityActions :context="{ type: 'loan', contractCode: view.loan.contractCode }" />
      </template>
    </LoanHeaderCard>

    <div class="card p-6">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-project">Full Loan Details</h2>
        <button type="button" class="btn-outline" :aria-expanded="showAll" @click="showAll = !showAll">
          Show / Hide
        </button>
      </div>
      <div v-if="showAll" class="mt-4 grid gap-6 lg:grid-cols-3" data-testid="loan-groups">
        <table v-for="g in view.groups" :key="g.title" class="w-full self-start text-left text-sm">
          <caption class="mb-1 text-left text-xs font-semibold uppercase text-muted">
            {{
              g.title
            }}
          </caption>
          <tbody>
            <tr v-for="r in g.rows" :key="r.label" class="border-t border-slate-100">
              <th class="py-1.5 pr-3 font-normal text-slate-500">{{ r.label }}</th>
              <td class="py-1.5">{{ r.value || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <SecurityPanels :context="{ type: 'loan', contractCode: view.loan.contractCode }" />
  </section>
</template>
