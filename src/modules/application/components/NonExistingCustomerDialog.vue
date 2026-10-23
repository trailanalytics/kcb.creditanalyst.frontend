<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { profilesApi } from '@/modules/customer/api'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { failureMessage } from '../submit'

/** "CAP NON EXISTING CUSTOMER" modal of the dashboard: a placeholder profile so a CAP can be captured. */
const open = defineModel<boolean>('open', { required: true })
const router = useRouter()

const classification = ref('')
const individual = ref({ name: '', fcs_number: '', nin: '', clientNumber: '' })
const company = ref({
  GSCAFB_BusinessName: '',
  GSCAFB_TradingName: '',
  fcs_number: '',
  clientNumber: '',
  reg_no: '',
  tin: '',
})
const busy = ref(false)

async function submit() {
  // the dialog traps focus, so it steps aside while the confirmation is up; what was typed is kept
  open.value = false
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'You are about to initiate capping for a non existing customer! Proceed?',
    input: 'checkbox',
    inputPlaceholder: 'I have contacted IT and confirmed that the account does not exist in CRB!',
    showCancelButton: true,
    confirmButtonText: 'Proceed',
    reverseButtons: true,
    inputValidator: (v) =>
      v ? undefined : 'Please confirm the existence of the account with IT and try again!',
  })
  if (!answer.isConfirmed) {
    open.value = true
    return
  }

  busy.value = true
  showLoader('processing, please wait...')
  try {
    const body =
      classification.value === '1'
        ? { ...company.value, classification: 1 }
        : { ...individual.value, classification: 0 }
    const { message, clientNumber } = await profilesApi.createNonExisting(body)
    Swal.close()
    showLoader(`${message} redirecting...`)
    await router.push(`/applications/create/${clientNumber}`)
    hideLoader()
  } catch (e) {
    await swalNotification('error', failureMessage(e))
    open.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-16 z-50 max-h-[85vh] w-[min(52rem,94vw)] -translate-x-1/2 overflow-y-auto rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <DialogTitle class="mb-4 text-base font-semibold uppercase tracking-wide text-project">
          CAP Non Existing Customer
        </DialogTitle>
        <div class="mb-4 flex items-center gap-4">
          <label for="nec-class" class="w-1/4 text-right text-sm">Customer Classification *</label>
          <select id="nec-class" v-model="classification" class="form-input flex-1">
            <option value="">---- select ----</option>
            <option value="0">Individual</option>
            <option value="1">Non Individual</option>
          </select>
        </div>

        <form v-if="classification === '0'" class="space-y-3" @submit.prevent="submit">
          <div class="flex items-center gap-4">
            <label for="nec-name" class="w-1/4 text-right text-sm">Full Name *</label>
            <input
              id="nec-name"
              v-model="individual.name"
              class="form-input flex-1"
              required
              placeholder="eg SOLOMON GODWIN LUDAAGA"
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-fcs" class="w-1/4 text-right text-sm">FCS Number</label>
            <input
              id="nec-fcs"
              v-model="individual.fcs_number"
              class="form-input flex-1"
              placeholder="FCS Number"
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-nin" class="w-1/4 text-right text-sm">NIN *</label>
            <input
              id="nec-nin"
              v-model="individual.nin"
              class="form-input flex-1"
              required
              placeholder="Customer's NIN"
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-cn" class="w-1/4 text-right text-sm">Client Number *</label>
            <input
              id="nec-cn"
              v-model="individual.clientNumber"
              class="form-input flex-1"
              required
              placeholder="Customer's Number"
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <DialogClose class="btn-outline" type="button">Cancel</DialogClose>
            <button type="submit" class="btn-primary-1" :disabled="busy">PROCEED</button>
          </div>
        </form>

        <form v-else-if="classification === '1'" class="space-y-3" @submit.prevent="submit">
          <div class="flex items-center gap-4">
            <label for="nec-bn" class="w-1/4 text-right text-sm">Business Name *</label>
            <input id="nec-bn" v-model="company.GSCAFB_BusinessName" class="form-input flex-1" required />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-tn" class="w-1/4 text-right text-sm">Trading Name *</label>
            <input id="nec-tn" v-model="company.GSCAFB_TradingName" class="form-input flex-1" required />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-cfcs" class="w-1/4 text-right text-sm">FCS Number</label>
            <input id="nec-cfcs" v-model="company.fcs_number" class="form-input flex-1" />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-ccn" class="w-1/4 text-right text-sm">Client Number *</label>
            <input
              id="nec-ccn"
              v-model="company.clientNumber"
              class="form-input flex-1"
              required
              placeholder="Customer's Number"
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-reg" class="w-1/4 text-right text-sm">Registration Number *</label>
            <input id="nec-reg" v-model="company.reg_no" class="form-input flex-1" required />
          </div>
          <div class="flex items-center gap-4">
            <label for="nec-tin" class="w-1/4 text-right text-sm">Tax Identification Number</label>
            <input id="nec-tin" v-model="company.tin" class="form-input flex-1" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <DialogClose class="btn-outline" type="button">Cancel</DialogClose>
            <button type="submit" class="btn-primary-1" :disabled="busy">PROCEED</button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
