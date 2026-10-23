<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { problemOf } from '@/api/http'
import { failureMessage } from '@/modules/application/submit'
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import ProfileRow from '@/modules/customer/components/ProfileRow.vue'
import { CLASSIFICATIONS } from '@/modules/customer/options'
import type { ProfileModel } from '@/modules/customer/types'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { guarantorsApi, stakeholdersApi } from '../api'
import { checkParty } from '../checks'
import { partyFormFor, partyPayload, partyTitle, switchClassification } from '../partyModel'
import type { GuarantorRow, PartyKind, PartyStart, SecurityContext, StakeholderRow } from '../types'

/**
 * Add / edit a guarantor or a stakeholder (`<manage-security>`): the modal's own fields (classification, value and type of the
 * guarantee, or the shareholding) around the embedded customer profile. `start` says how it was opened; `version` changes whenever
 * it is opened afresh, so closing and reopening after an error keeps what was typed.
 */
const props = defineProps<{
  kind: PartyKind
  start: PartyStart
  version: number
  context?: SecurityContext
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [row: GuarantorRow | StakeholderRow] }>()

const ref_ = useReferenceStore()
onMounted(() => ref_.load('branches', 'stakeholder-categories'))

const form = ref<ProfileModel>(partyFormFor(props.kind, props.start))
const invalid = ref<string[]>([])
const busy = ref(false)

watch(
  () => props.version,
  () => {
    form.value = partyFormFor(props.kind, props.start)
    invalid.value = []
  },
)

const title = computed(() => partyTitle(props.kind, form.value))
/** Only a brand new party can pick a classification; an existing customer keeps its own. */
const classificationLocked = computed(() => props.start.mode !== 'new')
const clientNumber = computed(() => form.value.clientNumber)
const cls = (field: string) => (invalid.value.includes(field) ? 'is-invalid' : '')
const set = (field: string, event: Event) => {
  form.value[field] = (event.target as HTMLInputElement).value
  invalid.value = invalid.value.filter((f) => f !== field)
}

function classificationChanged(event: Event) {
  form.value = switchClassification(props.kind, form.value, (event.target as HTMLSelectElement).value)
  invalid.value = []
}

const saved = computed(() =>
  props.kind === 'guarantor' ? 'Guarantor Saved Successfully' : 'Stakeholder Saved Successfully',
)

async function submit() {
  const check = checkParty(form.value, props.kind)
  invalid.value = check.invalid
  if (check.message) return void toast.error(check.message)

  busy.value = true
  showLoader('processing...')
  try {
    const body = partyPayload(form.value, props.context)
    const api = props.kind === 'guarantor' ? guarantorsApi : stakeholdersApi
    const row =
      props.start.mode === 'edit' ? await api.update(props.start.row.id, body) : await api.create(body)
    hideLoader()
    open.value = false
    toast.success(` ${saved.value}`)
    emit('saved', row)
  } catch (e) {
    const fields = problemOf(e)?.errors
    if (fields) invalid.value = Object.keys(fields).filter((f) => f in form.value)
    // the dialog traps focus, so it steps aside while the message is up
    open.value = false
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
        class="fixed left-1/2 top-8 z-50 max-h-[92vh] w-[min(64rem,96vw)] -translate-x-1/2 overflow-y-auto rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-4 text-base font-semibold uppercase tracking-wide text-project">{{
          title
        }}</DialogTitle>
        <form
          :id="kind === 'guarantor' ? 'guarantor-creation-form' : 'stakeholder-creation-form'"
          novalidate
          @submit.prevent="submit"
        >
          <ProfileRow v-if="clientNumber" label="ClientNumber">
            <input :value="clientNumber" class="form-input flex-1" readonly aria-label="Client number" />
          </ProfileRow>
          <ProfileRow label="Classification" star>
            <select
              :value="form.classificationCode"
              class="form-input w-1/2"
              :disabled="classificationLocked"
              aria-label="Classification"
              @change="classificationChanged"
            >
              <option v-for="c in CLASSIFICATIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </ProfileRow>

          <template v-if="kind === 'guarantor'">
            <ProfileRow label="Value of Guarantors Collateral" star>
              <input
                :value="form.ValueOfGuarantorsCollateral"
                name="ValueOfGuarantorsCollateral"
                class="form-input flex-1"
                :class="cls('ValueOfGuarantorsCollateral')"
                @input="set('ValueOfGuarantorsCollateral', $event)"
              />
            </ProfileRow>
            <ProfileRow label="Guarantee Type" star>
              <select
                :value="form.GuaranteeType"
                name="GuaranteeType"
                class="form-input flex-1"
                :class="cls('GuaranteeType')"
                aria-label="Guarantee type"
                @change="set('GuaranteeType', $event)"
              >
                <option value="">--- select ---</option>
                <option value="0">Full</option>
                <option value="1">Partial</option>
              </select>
            </ProfileRow>
            <ProfileRow label="Guarantor Type" star>
              <select
                :value="form.GuarantorType"
                name="GuarantorType"
                class="form-input flex-1"
                :class="cls('GuarantorType')"
                aria-label="Guarantor type"
                @change="set('GuarantorType', $event)"
              >
                <option value="">--- select ---</option>
                <option value="0">Guarantor</option>
                <option value="1">Solidarity Group Guarantor</option>
              </select>
            </ProfileRow>
          </template>
          <template v-else>
            <ProfileRow label="Shareholder Percentage" star>
              <input
                :value="form.ShareholderPercentage"
                name="ShareholderPercentage"
                type="number"
                min="0"
                step="any"
                class="form-input flex-1"
                :class="cls('ShareholderPercentage')"
                aria-label="Shareholder percentage"
                @input="set('ShareholderPercentage', $event)"
              />
            </ProfileRow>
            <ProfileRow label="Stakeholder Category" star>
              <select
                :value="form.StakeholderCategory"
                name="StakeholderCategory"
                class="form-input flex-1"
                :class="cls('StakeholderCategory')"
                aria-label="Stakeholder category"
                @change="set('StakeholderCategory', $event)"
              >
                <option value="">Select Category</option>
                <option v-for="c in ref_.items('stakeholder-categories')" :key="c.code" :value="c.code">
                  {{ c.value }}
                </option>
              </select>
            </ProfileRow>
          </template>
          <ProfileRow label="Branch Code" star>
            <select
              :value="form.branchCode"
              name="branchCode"
              class="form-input flex-1"
              :class="cls('branchCode')"
              aria-label="Branch code"
              @change="set('branchCode', $event)"
            >
              <option value="">Select Branch</option>
              <option v-for="b in ref_.branches" :key="b.id" :value="b.code ?? ''">{{ b.value }}</option>
            </select>
          </ProfileRow>

          <ProfileForm v-model="form" :invalid="invalid" embedded />

          <div class="mt-6 flex justify-end gap-2">
            <DialogClose class="btn-outline" type="button">Cancel</DialogClose>
            <button type="submit" class="btn-system" :disabled="busy">
              {{ kind === 'guarantor' ? 'Save Guarantor' : 'Save' }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
