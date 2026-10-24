<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { numberWithCommas } from '@/utils/format'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { adminConfigApi } from '../api'
import CredentialsForm from '../components/CredentialsForm.vue'
import { chargeProblems, failureMessage, fieldErrors } from '../logic'
import type { AdminConfiguration } from '../types'

/** /admin/configuration: the warehouse login and the CRB application charge. Opens on the first tab and keeps it after a save. */
const auth = useAuthStore()
const tab = ref<'credentials' | 'charges'>('credentials')
const config = ref<AdminConfiguration | null>(null)
const loadError = ref('')
const account = ref('')
const amount = ref('')
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const canUpdateCredentials = computed(() => auth.has('Update T24 Credentials'))

async function load() {
  try {
    config.value = await adminConfigApi.load()
    account.value = config.value.crb_charge.crb_suspense_account ?? ''
    amount.value = numberWithCommas(config.value.crb_charge.credit_amount ?? 0)
  } catch (e) {
    loadError.value = messageOf(e, 'The configuration could not be loaded.')
  }
}
onMounted(load)

async function saveCharges() {
  errors.value = chargeProblems(account.value, amount.value)
  if (Object.keys(errors.value).length) return
  busy.value = true
  showLoader('processing...')
  try {
    const result = await adminConfigApi.saveCharges({
      crb_suspense_account: account.value.trim(),
      credit_amount: amount.value,
    })
    hideLoader()
    await swalNotification('success', result.message)
    await load()
  } catch (e) {
    hideLoader()
    errors.value = fieldErrors(e)
    const message = failureMessage(e, 'Failed to process your request!')
    if (message && !Object.keys(errors.value).length) await swalNotification('error', message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="px-2 pt-2">
    <div class="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'credentials'"
        class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="
          tab === 'credentials'
            ? 'border-project font-medium text-project'
            : 'border-transparent text-muted hover:text-ink'
        "
        @click="tab = 'credentials'"
      >
        T24 Credentials
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'charges'"
        class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="
          tab === 'charges'
            ? 'border-project font-medium text-project'
            : 'border-transparent text-muted hover:text-ink'
        "
        @click="tab = 'charges'"
      >
        CRB Application Charges
      </button>
    </div>
    <p v-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>
    <p v-else-if="!config" class="text-sm text-muted">loading…</p>
    <div v-else class="card px-4 py-5">
      <CredentialsForm
        v-if="tab === 'credentials'"
        :status="config.t24"
        :can-update="canUpdateCredentials"
        :save="adminConfigApi.saveCredentials"
        button="SAVE CHANGES"
        @saved="load"
      />
      <form v-else class="max-w-xl space-y-4" novalidate @submit.prevent="saveCharges">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">CRB Suspense Account</span>
          <input
            v-model="account"
            class="form-input"
            :class="{ 'is-invalid': errors.crb_suspense_account }"
            name="crb_suspense_account"
            autocomplete="off"
          />
          <span v-if="errors.crb_suspense_account" class="text-xs text-danger">{{
            errors.crb_suspense_account
          }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">Credit Amount</span>
          <input
            v-model="amount"
            class="form-input"
            :class="{ 'is-invalid': errors.credit_amount }"
            inputmode="decimal"
            name="credit_amount"
            autocomplete="off"
          />
          <span v-if="errors.credit_amount" class="text-xs text-danger">{{ errors.credit_amount }}</span>
        </label>
        <button type="submit" class="btn-system" :disabled="busy">SAVE CHANGES</button>
      </form>
    </div>
  </section>
</template>
