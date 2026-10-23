<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import CustomerHeader from '@/modules/customer/components/CustomerHeader.vue'
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import { profilesApi } from '@/modules/customer/api'
import { confirmClassificationChange } from '@/modules/customer/classification'
import { profileFrom } from '@/modules/customer/profileModel'
import { checkProfile, TRADING_NAME_MESSAGE } from '@/modules/customer/profileRules'
import { NON_INDIVIDUAL, type Customer, type ProfileModel } from '@/modules/customer/types'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { applicationsApi } from './api'
import LoanDetailsFields from './components/LoanDetailsFields.vue'
import { checkLoan, emptyLoan, loanFrom } from './loanModel'
import { showFailure } from './submit'
import { PENDING, type LoanModel } from './types'

/**
 * New CAP for a client (`/applications/create/{clientNumber}`) or edit of a pending one (`/applications/edit/{id}`):
 * cap/create.blade.php. The profile is reviewed and saved in the same request as the application.
 */
const props = defineProps<{ clientNumber?: string; id?: string }>()
const router = useRouter()
const editing = computed(() => props.id !== undefined)

const customer = ref<Customer | null>(null)
const profile = ref<ProfileModel | null>(null)
const loan = ref<LoanModel>(emptyLoan())
const currentAccount = ref('')
const isJoint = ref(false)
const isRestructured = ref(false)
const invalidProfile = ref<string[]>([])
const invalidLoan = ref<string[]>([])
const busy = ref(false)
let accountClicks = 0
const accountLocked = ref(true)

async function load() {
  try {
    if (props.id) {
      const application = await applicationsApi.get(props.id)
      if (application.creditApplicationStatus !== PENDING) {
        await swalNotification('error', 'You can only edit pending applications')
        return void (await router.replace('/applications'))
      }
      if (!application.customer) throw new Error('The customer of this application no longer exists.')
      customer.value = application.customer
      loan.value = loanFrom(application)
      isJoint.value = Boolean(application.jointAccountNumber)
    } else {
      const found = await profilesApi.get(props.clientNumber ?? '')
      customer.value = found
    }
    profile.value = profileFrom(customer.value as Customer)
    currentAccount.value = String(customer.value?.currentAccount ?? '')
    invalidProfile.value = []
    invalidLoan.value = []
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The customer could not be loaded.'))
    await router.replace('/applications')
  }
}
onMounted(load)

function unlockAccount() {
  accountClicks += 1
  if (accountClicks >= 3) accountLocked.value = false
}

async function classificationChanged(value: string) {
  if (!customer.value || !profile.value) return
  const current = customer.value.classificationCode ?? '0'
  if (value === current) return
  if (await confirmClassificationChange(customer.value.clientNumber, current)) await load()
  else if (profile.value) profile.value.classificationCode = current
}

function payload(): Record<string, unknown> {
  const l = loan.value
  return {
    ...profile.value,
    clientNumber: customer.value?.clientNumber,
    currentAccount: currentAccount.value,
    creditApplicationDate: l.creditApplicationDate,
    creditApplicationReference: editing.value ? l.creditApplicationReference : undefined,
    currency: l.currency,
    amount: l.amount === null ? '' : String(l.amount),
    CreditAccountLoanProductType: l.CreditAccountLoanProductType,
    Term: l.Term,
    Term_Period: l.Term_Period,
    loanPurpose: l.loanPurpose,
    branch: l.branch,
    jointAccountNumber: isJoint.value ? l.jointAccountNumber : '',
    restructuredAccountNumber: isRestructured.value ? l.restructuredAccountNumber : '',
  }
}

async function proceed() {
  if (!profile.value || !customer.value) return
  const check = checkProfile(profile.value)
  const missing = checkLoan(loan.value)
  invalidProfile.value = check.invalid
  invalidLoan.value = missing
  if (check.message || missing.length)
    return void toast.error(
      check.message ?? 'Kindly check inputs with a red border and fill in appropriately!',
    )
  if (profile.value.classificationCode === NON_INDIVIDUAL && !(profile.value.GSCAFB_TradingName ?? '').trim())
    return void swalNotification('error', TRADING_NAME_MESSAGE)

  busy.value = true
  try {
    const body = payload()
    if (!editing.value) {
      showLoader('checking for duplicate applications...')
      try {
        const result = await applicationsApi.checkDuplicate(customer.value.clientNumber, body)
        if (result.duplicate) {
          await swalNotification('error', result.message ?? 'Duplicate credit application!')
          return
        }
      } catch {
        // as before: when the check itself fails the save goes ahead, and the server checks again
      }
    }
    showLoader('processing...')
    const saved = editing.value
      ? await applicationsApi.update(props.id as string, body)
      : await applicationsApi.create(body)
    hideLoader()
    await router.push(`/applications/show/${saved.id}`)
    await swalNotification('success', 'Application Created Successfully')
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="customer && profile" class="mx-auto max-w-5xl px-2">
    <form id="cap-creation-form" novalidate @submit.prevent="proceed">
      <div class="card mb-4 flex flex-wrap items-start justify-between gap-6 p-6">
        <div>
          <CustomerHeader :customer="customer" />
          <div class="mt-3 flex items-center gap-2 text-sm">
            <label for="current-account" class="font-semibold">Ac/No:</label>
            <input
              id="current-account"
              v-model="currentAccount"
              class="form-input w-48"
              :readonly="accountLocked"
              title="Client's Current Account Number. Click thrice to edit this field"
              @click="unlockAccount"
            />
          </div>
        </div>
        <div class="space-y-2 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="isJoint" type="checkbox" name="isJointApplication" /> Is a Joint Application?
          </label>
          <div v-if="isJoint">
            <label for="joint-number" class="mb-1 block text-slate-600">Joint Account Number</label>
            <input
              id="joint-number"
              v-model="loan.jointAccountNumber"
              class="form-input"
              :readonly="editing"
            />
          </div>
        </div>
        <div class="space-y-2 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="isRestructured" type="checkbox" name="isRestructuredLoanApplication" /> Is a
            Restructured Loan Application?
          </label>
          <div v-if="isRestructured">
            <label for="previous-loan" class="mb-1 block text-slate-600">Previous Loan Account</label>
            <input
              id="previous-loan"
              v-model="loan.restructuredAccountNumber"
              class="form-input"
              placeholder="eg AA182560YBCR"
            />
          </div>
        </div>
      </div>

      <div class="card p-6">
        <LoanDetailsFields v-model="loan" :editing="editing" :invalid="invalidLoan" id-prefix="cap" />
        <h3 class="mb-1 mt-8 text-lg text-muted">Review/Edit Borrower Details</h3>
        <hr class="mb-4" />
        <ProfileForm
          v-model="profile"
          :invalid="invalidProfile"
          new-cap
          @classification-change="classificationChanged"
        />
        <div class="mt-8 flex justify-center">
          <button type="submit" class="btn-system w-full md:w-1/3" :disabled="busy">Proceed</button>
        </div>
      </div>
    </form>
  </section>
</template>
