<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue'
import { useProfileOptions, CLASSIFICATIONS } from '../options'
import { provideProfile } from '../profileContext'
import { NON_INDIVIDUAL, type ProfileModel } from '../types'
import { swalNotification } from '@/utils/dialogs'
import ProfileRow from './ProfileRow.vue'
import ProfileInput from './ProfileInput.vue'
import IndividualFields from './IndividualFields.vue'
import CompanyFields from './CompanyFields.vue'
import AddressFields from './AddressFields.vue'

/**
 * The borrower profile (resources/views/profile/form/*): classification, individual or company fields, address and
 * alternative address. Used by Edit Profile, the CAP forms and the joint CAP (one instance per borrower).
 *
 * `newCap` drops the first section heading, as the CAP forms did. The alternative address follows the primary one while the
 * user types, as `profileAlternativeAddress` did.
 */
const props = withDefaults(
  defineProps<{
    invalid?: string[]
    newCap?: boolean
    joint?: boolean
    classificationLocked?: boolean
    embedded?: boolean
  }>(),
  { invalid: () => [], newCap: false, joint: false, classificationLocked: false, embedded: false },
)
const form = defineModel<ProfileModel>({ required: true })
const emit = defineEmits<{ classificationChange: [value: string] }>()

const options = useProfileOptions()
const loaded = ref(false)
onMounted(async () => {
  await options.load()
  loaded.value = true
})

const invalidFields = ref<string[]>([])
watch(
  () => props.invalid,
  (v) => (invalidFields.value = [...v]),
  { immediate: true },
)

const id = useId()
provideProfile({
  get form() {
    return form.value
  },
  invalid: invalidFields,
  id,
  get embedded() {
    return props.embedded
  },
  set(name, value) {
    form.value[name] = value
    invalidFields.value = invalidFields.value.filter((f) => f !== name)
    // the embedded forms never copied the apartment name
    if (name.startsWith('PCI_') && !(props.embedded && name === 'PCI_UnitName'))
      form.value[`SCI_${name.slice(4)}`] = value
  },
})

let clicks = 0
function clientNumberClicked() {
  clicks += 1
  if (clicks >= 3) {
    clicks = 0
    void swalNotification('info', 'Editing client numbers is currently disabled!')
  }
}

const isCompany = () => form.value.classificationCode === NON_INDIVIDUAL
</script>

<template>
  <div v-if="loaded" class="profile-form">
    <ProfileRow v-if="!embedded" label="Client Number">
      <input
        :id="`${id}-clientNumber`"
        :value="form.clientNumber"
        class="form-input flex-1"
        placeholder="Client Number"
        readonly
        @click="clientNumberClicked"
      />
    </ProfileRow>
    <ProfileRow v-if="!embedded" label="Branch Code"
      ><ProfileInput name="branchCode" :options="options.branches.value" blank="Select Branch"
    /></ProfileRow>
    <ProfileRow v-if="!embedded" label="Classification">
      <ProfileInput
        name="classificationCode"
        :options="CLASSIFICATIONS"
        :disabled="classificationLocked"
        width="w-1/2"
        @change="emit('classificationChange', $event)"
      />
    </ProfileRow>

    <CompanyFields v-if="isCompany()" :show-heading="!newCap && !embedded" :hide-vat="joint" />
    <IndividualFields v-else :show-heading="!newCap && !embedded" />

    <AddressFields prefix="PCI_" title="Address" />
    <AddressFields prefix="SCI_" title="Alternative Address" />
  </div>
  <p v-else class="py-8 text-center text-sm text-muted">loading…</p>
</template>
