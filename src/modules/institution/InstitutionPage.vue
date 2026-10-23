<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProfileOptions, type Opt } from '@/modules/customer/options'
import AddressFields from '@/modules/customer/components/AddressFields.vue'
import ProfileDateParts from '@/modules/customer/components/ProfileDateParts.vue'
import ProfileInput from '@/modules/customer/components/ProfileInput.vue'
import ProfileRow from '@/modules/customer/components/ProfileRow.vue'
import type { ProfileModel } from '@/modules/customer/types'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { institutionApi } from './api'
import {
  addressFrom,
  ADDRESS_REQUIRED,
  emptyAddress,
  FORM_LOOKUPS,
  missing,
  REQUIRED_MESSAGE,
} from './addressModel'
import ContextForm from './components/ContextForm.vue'
import { showFailure } from './failure'
import type { InstitutionRecord } from './types'

/** /institution: the participating institution's own details (institution/index.blade.php + InstitutionIndex.vue). */
const REQUIRED = [
  'IdentificationCode',
  'InstitutionType',
  'InstitutionName',
  'licenceDay',
  'licenceMonth',
  'licenceYear',
  'LicenseNumber',
]

const options = useProfileOptions()
const reference = useReferenceStore()
const form = ref<ProfileModel | null>(null)
const invalid = ref<string[]>([])
const busy = ref(false)
const institutionTypes = computed<Opt[]>(() =>
  reference.items('institution-types').map((i) => ({ value: i.code, label: i.value })),
)

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

function formFrom(record: InstitutionRecord): ProfileModel {
  const m: ProfileModel = {
    IdentificationCode: text(record.IdentificationCode),
    InstitutionType: text(record.InstitutionType),
    InstitutionName: text(record.InstitutionName),
    LicenseNumber: text(record.LicenseNumber),
    licenceDay: text(record.license_issue_variable?.day),
    licenceMonth: text(record.license_issue_variable?.month),
    licenceYear: text(record.license_issue_variable?.year),
    ...emptyAddress(),
  }
  addressFrom(m, record, record.moved_variable)
  return m
}

onMounted(async () => {
  await Promise.all([options.load(), reference.load(...FORM_LOOKUPS)])
  form.value = formFrom(await institutionApi.record())
})

async function save() {
  if (!form.value) return
  invalid.value = missing(form.value, [...REQUIRED, ...ADDRESS_REQUIRED])
  if (invalid.value.length) return void toast.error(REQUIRED_MESSAGE)
  busy.value = true
  showLoader('processing...')
  try {
    const saved = await institutionApi.saveRecord(form.value)
    form.value = formFrom(saved)
    hideLoader()
    await swalNotification('success', 'Institution details Saved Successfully')
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-5xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Participating Institution
    </nav>
    <form v-if="form" class="card p-6" novalidate @submit.prevent="save">
      <ContextForm v-model="form" :invalid="invalid">
        <ProfileRow label="Identification Code">
          <ProfileInput name="IdentificationCode" placeholder="Identification Code" />
        </ProfileRow>
        <ProfileRow label="Institution Type">
          <ProfileInput name="InstitutionType" :options="institutionTypes" blank="Select " />
        </ProfileRow>
        <ProfileRow label="Institution Name">
          <ProfileInput name="InstitutionName" placeholder="Institution Name" />
        </ProfileRow>
        <ProfileRow label="License Issue Date">
          <ProfileDateParts day="licenceDay" month="licenceMonth" year="licenceYear" :from="1920" />
        </ProfileRow>
        <ProfileRow label="License Number">
          <ProfileInput name="LicenseNumber" placeholder="License Number" />
        </ProfileRow>
        <AddressFields prefix="PCI_" title="Address" />
      </ContextForm>
      <div class="mt-8 flex justify-center">
        <button type="submit" class="btn-system w-full md:w-1/4" :disabled="busy">Save</button>
      </div>
    </form>
    <p v-else class="py-8 text-center text-sm text-muted">loading…</p>
  </section>
</template>
