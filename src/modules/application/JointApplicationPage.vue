<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { profilesApi } from '@/modules/customer/api'
import CustomerHeader from '@/modules/customer/components/CustomerHeader.vue'
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import { profileFrom } from '@/modules/customer/profileModel'
import { checkProfile } from '@/modules/customer/profileRules'
import { NON_INDIVIDUAL, type Customer, type ProfileModel } from '@/modules/customer/types'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { applicationsApi } from './api'
import LoanDetailsFields from './components/LoanDetailsFields.vue'
import { checkLoan, emptyLoan } from './loanModel'
import { showFailure } from './submit'
import type { LoanModel } from './types'

/** /applications/joint/create/{A-B-C}: one block per borrower (cap/joint.blade.php); saved together under one joint account number. */
const props = defineProps<{ args: string }>()
const router = useRouter()

interface Block {
  customer: Customer
  profile: ProfileModel
  loan: LoanModel
  invalidProfile: string[]
  invalidLoan: string[]
}
const blocks = ref<Block[]>([])
const jointAccountNumber = ref('')
const busy = ref(false)
const clientNumbers = computed(() => props.args.split('-').filter(Boolean))

onMounted(async () => {
  try {
    const customers = await Promise.all(clientNumbers.value.map((cn) => profilesApi.get(cn)))
    blocks.value = customers.map((c) => ({
      customer: c,
      profile: profileFrom(c),
      loan: emptyLoan(),
      invalidProfile: [],
      invalidLoan: [],
    }))
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The customers could not be loaded.'))
    await router.replace('/applications')
  }
})

async function proceed() {
  let message: string | null = null
  for (const b of blocks.value) {
    const check = checkProfile(b.profile, { joint: true })
    b.invalidProfile = check.invalid
    b.invalidLoan = checkLoan(b.loan)
    message ??=
      check.message ??
      (b.invalidLoan.length ? 'Kindly check inputs with a red border and fill in appropriately!' : null)
  }
  if (message) return void toast.error(message)
  if (
    blocks.value.some(
      (b) => b.profile.classificationCode === NON_INDIVIDUAL && !(b.profile.GSCAFB_TradingName ?? '').trim(),
    )
  )
    return void swalNotification('error', 'The Trading Name is required for every Non Individual borrower!')

  busy.value = true
  showLoader('processing...')
  try {
    const borrowers = blocks.value.map((b) => ({
      ...b.profile,
      clientNumber: b.customer.clientNumber,
      creditApplicationDate: b.loan.creditApplicationDate,
      currency: b.loan.currency,
      amount: b.loan.amount === null ? '' : String(b.loan.amount),
      CreditAccountLoanProductType: b.loan.CreditAccountLoanProductType,
      Term: b.loan.Term,
      Term_Period: b.loan.Term_Period,
      loanPurpose: b.loan.loanPurpose,
      branch: b.loan.branch,
    }))
    const result = await applicationsApi.joint({ borrowers, jointAccountNumber: jointAccountNumber.value })
    hideLoader()
    await router.push('/applications')
    await swalNotification('success', result.message)
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="blocks.length" class="mx-auto max-w-5xl px-2">
    <form id="cap-creation-form" novalidate @submit.prevent="proceed">
      <div v-for="(b, i) in blocks" :key="b.customer.clientNumber" class="card mb-6 p-6">
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <CustomerHeader :customer="b.customer" />
          <div v-if="i === 0" class="text-sm">
            <label for="joint-number" class="mb-1 block text-slate-600"
              >Joint Account Number <i>(supply if available)</i></label
            >
            <input id="joint-number" v-model="jointAccountNumber" class="form-input" />
          </div>
        </div>
        <LoanDetailsFields v-model="b.loan" :invalid="b.invalidLoan" :id-prefix="`cap${i}`" />
        <h3 class="mb-1 mt-8 text-lg text-muted">Review/Edit Borrower Details</h3>
        <hr class="mb-4" />
        <ProfileForm v-model="b.profile" :invalid="b.invalidProfile" new-cap joint classification-locked />
      </div>
      <div class="mb-8 flex justify-center">
        <button type="submit" class="btn-system w-full md:w-1/3" :disabled="busy">Proceed</button>
      </div>
    </form>
  </section>
</template>
