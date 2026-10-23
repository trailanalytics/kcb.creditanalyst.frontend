<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import DateField from '@/components/ui/DateField.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { useReferenceStore } from '@/stores/reference'
import { swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import LoanHeaderCard from './components/LoanHeaderCard.vue'
import { errorLines } from './loanModel'
import type { LoanView } from './types'

/** /loans/write-off/{id}: write a loan off (cba/writeoff_accounts.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const ref_ = useReferenceStore()
const view = ref<LoanView | null>(null)
const amount = ref<number | null>(null)
const closureDate = ref<string | null>(dayjs().format('YYYY-MM-DD'))
const closureReason = ref('3')
const errors = ref<string[]>([])
const busy = ref(false)

const currencies = computed(() => {
  const codes = ref_.items('currencies').map((c) => c.code)
  return ['UGX', ...codes.filter((c) => c !== 'UGX')]
})

async function load() {
  view.value = await loansApi.writeOffForm(props.id)
  const balance = view.value.loan.currentBalanceAmount
  amount.value = balance === null || balance === '' || Number.isNaN(Number(balance)) ? null : Number(balance)
}

onMounted(async () => {
  try {
    await Promise.all([load(), ref_.load('currencies')])
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The loan could not be loaded.'))
    await router.replace('/loans')
  }
})

async function submit() {
  errors.value = []
  busy.value = true
  try {
    const result = await loansApi.writeOff(props.id, {
      written_off_amt: amount.value === null ? '' : String(amount.value),
      closure_date: closureDate.value ?? '',
      closure_reason: closureReason.value,
    })
    await swalNotification('success', result.message)
    await load()
  } catch (e) {
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
      errors.value = errorLines(problem.errors)
    else await swalNotification('error', messageOf(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="view" class="mx-auto max-w-6xl">
    <LoanHeaderCard :view="view" extra />
    <form class="card mx-auto max-w-3xl space-y-4 p-6" @submit.prevent="submit">
      <div
        v-if="errors.length"
        class="rounded border border-red-200 bg-red-50 p-3 text-sm text-danger"
        role="alert"
      >
        <b>Form Validation Failed!</b>
        <ul class="mt-1 list-disc pl-5">
          <li v-for="m in errors" :key="m">{{ m }}</li>
        </ul>
      </div>
      <div class="grid items-center gap-3 sm:grid-cols-[10rem_1fr]">
        <label class="text-sm sm:text-right">Written off Amount</label>
        <div class="grid grid-cols-[7rem_1fr] gap-2">
          <select
            class="form-input"
            :value="view.loan.currency ?? 'UGX'"
            disabled
            aria-label="Currency of the loan"
            title="The write-off is recorded in the loan's own currency"
          >
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
          <MoneyInput v-model="amount" name="written_off_amt" />
        </div>
      </div>
      <div class="grid items-center gap-3 sm:grid-cols-[10rem_1fr]">
        <label class="text-sm sm:text-right">Closure Date</label>
        <DateField v-model="closureDate" />
      </div>
      <div class="grid items-center gap-3 sm:grid-cols-[10rem_1fr]">
        <label class="text-sm sm:text-right" for="wo-reason">Closure Reason</label>
        <select id="wo-reason" v-model="closureReason" class="form-input">
          <option value="3">Written Off</option>
        </select>
      </div>
      <button type="submit" class="btn-system w-full py-3" :disabled="busy">Write Off Loan</button>
    </form>
  </section>
</template>
