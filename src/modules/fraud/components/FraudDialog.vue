<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import ProfileDateParts from '@/modules/customer/components/ProfileDateParts.vue'
import ProfileInput from '@/modules/customer/components/ProfileInput.vue'
import ProfileRow from '@/modules/customer/components/ProfileRow.vue'
import { CLASSIFICATIONS, useProfileOptions, type Opt } from '@/modules/customer/options'
import ContextForm from '@/modules/institution/components/ContextForm.vue'
import { checkEmbedded } from '@/modules/institution/embeddedProfile'
import { showFailure } from '@/modules/institution/failure'
import { useReferenceStore } from '@/stores/reference'
import { toast } from '@/utils/dialogs'
import { fraudApi } from '../api'
import { fraudBody, FRAUD_REQUIRED, type FraudForm } from '../fraudModel'
import type { FraudRecord } from '../types'

/**
 * Register Fraud / Update Fraud (fra/register_fraud.blade.php): the incident and, below it, the customer's profile, saved
 * together. Opened with the form already built by the page.
 */
const props = defineProps<{ form: FraudForm | null; editingId: number | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [record: FraudRecord] }>()

const options = useProfileOptions()
const reference = useReferenceStore()
const invalid = ref<string[]>([])
const busy = ref(false)
const model = ref<FraudForm | null>(null)

watch(
  () => props.form,
  (f) => {
    model.value = f
    invalid.value = []
  },
  { immediate: true },
)

const categories = computed<Opt[]>(() =>
  reference.items('fraud-categories').map((i) => ({ value: i.code, label: i.value })),
)
// UGX first, then the appendix currencies without a second UGX
const currencies = computed<Opt[]>(() => [
  { value: 'UGX', label: 'UGX' },
  ...reference
    .items('currencies')
    .filter((i) => i.code !== 'UGX')
    .map((i) => ({ value: i.code, label: i.code })),
])
const forensic: Opt[] = [
  { value: 'A', label: 'Available' },
  { value: 'N', label: 'Not Available' },
]
const title = computed(() => (props.editingId ? 'Update Fraud' : 'Register Fraud'))

async function save() {
  if (!model.value) return
  const check = checkEmbedded(model.value.profile, FRAUD_REQUIRED)
  invalid.value = check.invalid
  if (check.message) return void toast.error(check.message)
  // no loader dialog here: SweetAlert and this modal both toggle aria-hidden on the page and leave it set
  busy.value = true
  try {
    const body = fraudBody(model.value)
    const record = props.editingId
      ? await fraudApi.update(props.editingId, body)
      : await fraudApi.create(body)
    open.value = false
    emit('saved', record)
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}

void options.load()
void reference.load('fraud-categories', 'currencies')
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-8 z-50 max-h-[92vh] w-[min(70rem,96vw)] -translate-x-1/2 overflow-y-auto rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @pointer-down-outside.prevent
        @interact-outside.prevent
        @escape-key-down.prevent
      >
        <div class="mb-4 flex items-center justify-between">
          <DialogTitle class="text-base font-semibold text-project">{{ title }}</DialogTitle>
          <DialogClose class="text-2xl leading-none text-danger" aria-label="Close">×</DialogClose>
        </div>
        <form v-if="model" novalidate @submit.prevent="save">
          <ContextForm v-model="model.profile" :invalid="invalid">
            <ProfileRow label="Fraud Category">
              <ProfileInput name="fraudCategory" :options="categories" blank="Select category" />
            </ProfileRow>
            <ProfileRow label="Incident Date">
              <ProfileDateParts day="incident_day" month="incident_month" year="incident_year" :from="1920" />
            </ProfileRow>
            <ProfileRow label="Savings Amount">
              <div class="w-full"><MoneyInput v-model="model.savings" name="saving_amount" /></div>
            </ProfileRow>
            <ProfileRow label="Loss Amount">
              <div class="w-full"><MoneyInput v-model="model.loss" name="loss_amount" /></div>
            </ProfileRow>
            <ProfileRow label="Currency"><ProfileInput name="currency" :options="currencies" /></ProfileRow>
            <ProfileRow label="Incident details">
              <textarea
                :value="model.profile.incidentDetails"
                name="incidentDetails"
                rows="5"
                class="form-input flex-1"
                :class="{ 'is-invalid': invalid.includes('incidentDetails') }"
                @input="model.profile.incidentDetails = ($event.target as HTMLTextAreaElement).value"
              ></textarea>
            </ProfileRow>
            <ProfileRow label="Forensic Information Available">
              <ProfileInput name="forensicInformation" :options="forensic" blank="Select" />
            </ProfileRow>
            <ProfileRow v-if="model.profile.clientNumber" label="ClientNumber">
              <input
                :value="model.profile.clientNumber"
                name="clientNumber"
                readonly
                class="form-input flex-1"
              />
            </ProfileRow>
            <ProfileRow label="Classification">
              <ProfileInput
                name="classificationCode"
                :options="CLASSIFICATIONS"
                :disabled="Boolean(model.profile.profile_id)"
                width="w-1/2"
              />
            </ProfileRow>
            <ProfileRow label="Branch Code">
              <ProfileInput name="branchCode" :options="options.branches.value" blank="Select Branch" />
            </ProfileRow>
            <ProfileForm v-model="model.profile" embedded :invalid="invalid" />
          </ContextForm>
          <div class="mt-8 flex justify-center">
            <button type="submit" class="btn-system w-full md:w-1/3" :disabled="busy">
              {{ busy ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
