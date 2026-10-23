<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import { applicationsApi } from './api'
import { crbToLong, termText } from './loanModel'
import { showFailure } from './submit'
import { APPROVED, PENDING, type Application, type LoanAccountRow } from './types'

/** /applications/change-status/{id}: approve (optionally against a loan) or decline a pending CAP (cap/change_status.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const ref_ = useReferenceStore()
const app = ref<Application | null>(null)
const loans = ref<LoanAccountRow[]>([])
const status = ref('')
const rejectionReason = ref('')
const loanAccountNumber = ref('')
const amount = ref<number | null>(null)
const term = ref('')
const busy = ref(false)

const pending = computed(() => app.value?.creditApplicationStatus === PENDING)
const rejecting = computed(() => status.value !== '' && status.value !== APPROVED && status.value !== PENDING)

onMounted(async () => {
  try {
    const [a, l] = await Promise.all([
      applicationsApi.get(props.id),
      applicationsApi.loanAccounts(props.id),
      ref_.load('application-statuses', 'rejection-reasons', 'loan-product-types', 'loan-purposes'),
    ])
    app.value = a
    loans.value = l
    amount.value = a.Amount ? Number(a.Amount) : null
    term.value = a.Term ?? ''
    status.value = pending.value ? '' : (a.creditApplicationStatus ?? '')
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The application could not be loaded.'))
    await router.replace('/applications')
  }
})
watch(status, () => (rejectionReason.value = ''))

async function submit() {
  if (!app.value || !pending.value) return
  busy.value = true
  showLoader('processing...')
  try {
    const body: Record<string, unknown> = { creditApplicationStatus: status.value, term: term.value }
    if (status.value === APPROVED) {
      body.loanAccountNumber = loanAccountNumber.value
      body.amount = amount.value === null ? '' : String(amount.value)
    } else if (rejecting.value) {
      body.rejectionReason = rejectionReason.value
    }
    await applicationsApi.decide(app.value.id, body)
    hideLoader()
    await router.push('/applications')
    await swalNotification(
      'success',
      status.value === APPROVED ? 'Loan Application Approved Successfully' : 'Declined Successfully',
    )
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}

const loanStatus = (s: string | null) =>
  ({ '5': 'Current', '4': 'Closed', '3': 'Written Off', '1': 'Overdue' })[s ?? ''] ?? ''
</script>

<template>
  <section v-if="app" class="mx-auto max-w-6xl">
    <div class="card mb-6 flex flex-wrap justify-between gap-6 p-6 text-sm">
      <div class="flex gap-4">
        <img src="/img/profile-placeholder.jpg" alt="" width="120" class="rounded" />
        <div>
          <h1 class="text-xl font-semibold text-project">
            {{ app.customer?.full_name.trim() || 'Unnamed customer' }}
          </h1>
          <div>FCS No: {{ app.customer?.II_FCSNumber || '—' }}</div>
          <div>Amount: {{ app.currency }} {{ formatNumber(app.Amount) }}</div>
          <div>Ref: {{ app.creditApplicationReference }}</div>
          <div>Term: {{ termText(app.Term, app.TermPeriod) }}</div>
        </div>
      </div>
      <div>
        <div>Client No: {{ app.clientNumber }}</div>
        <div>Date: {{ crbToLong(app.creditApplicationDate) }}</div>
        <div>Status: {{ ref_.label('application-statuses', app.creditApplicationStatus) }}</div>
        <div>Type: {{ ref_.label('loan-product-types', app.creditAccountLoanProductType) }}</div>
        <div>Purpose: {{ ref_.label('loan-purposes', app.loanPurpose) }}</div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-12">
      <form class="card space-y-4 p-6 lg:col-span-4" @submit.prevent="submit">
        <h2 class="text-lg font-semibold text-project">Change Status</h2>
        <label class="block text-sm">
          Application Status<span v-if="pending"> *</span>
          <select v-model="status" class="form-input mt-1" :disabled="!pending" required>
            <option value="">--- select ---</option>
            <option v-for="s in ref_.items('application-statuses')" :key="s.code" :value="s.code">
              {{ s.value }}
            </option>
          </select>
        </label>
        <label v-if="pending && rejecting" class="block text-sm">
          Rejection Reason *
          <select v-model="rejectionReason" class="form-input mt-1" required>
            <option value="">--- select ---</option>
            <option v-for="r in ref_.items('rejection-reasons')" :key="r.code" :value="r.code">
              {{ r.value }}
            </option>
          </select>
        </label>
        <template v-if="pending && status === APPROVED">
          <label class="block text-sm">
            Loan Account Number (optional)
            <input v-model="loanAccountNumber" class="form-input mt-1" placeholder="AA3463738898" />
          </label>
          <label class="block text-sm">
            Amount Approved
            <MoneyInput v-model="amount" name="amount" />
          </label>
        </template>
        <label class="block text-sm">
          Term (in months)
          <input v-model="term" type="number" min="1" class="form-input mt-1" required :disabled="!pending" />
        </label>
        <button v-if="pending" type="submit" class="btn-primary-1 w-full" :disabled="busy">
          Update Application Status
        </button>
      </form>

      <div class="card overflow-x-auto lg:col-span-8">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Contract Code</th>
              <th class="px-4 py-3">Contract Date</th>
              <th class="px-4 py-3">Amount</th>
              <th class="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in loans" :key="l.id" class="border-t border-slate-100">
              <td class="px-4 py-3">{{ l.contractCode }}</td>
              <td class="px-4 py-3">{{ l.contractDate }}</td>
              <td class="px-4 py-3">{{ l.currency }} {{ formatNumber(l.creditAmount) }}</td>
              <td class="px-4 py-3">{{ loanStatus(l.creditAccountStatus) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
