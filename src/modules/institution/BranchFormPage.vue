<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
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
import type { BankBranch } from './types'

/** /branches/new and /branches/edit/{id}: one form (branches/create.blade.php, edit.blade.php). */
const props = defineProps<{ id?: string }>()
const router = useRouter()
const options = useProfileOptions()
const reference = useReferenceStore()
const editing = computed(() => props.id !== undefined)

const REQUIRED = [
  'BranchName',
  'bankBranchCode',
  'BranchIdentificationCode',
  'BranchType',
  'openDay',
  'openMonth',
  'openYear',
]

const form = ref<ProfileModel | null>(null)
const invalid = ref<string[]>([])
const busy = ref(false)
const branchTypes = computed<Opt[]>(() =>
  reference.items('branch-types').map((i) => ({ value: i.code, label: i.value })),
)

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

function formFrom(branch?: BankBranch): ProfileModel {
  const m: ProfileModel = {
    BranchName: text(branch?.BranchName),
    bankBranchCode: text(branch?.bankBranchCode),
    BranchIdentificationCode: text(branch?.BranchIdentificationCode),
    BranchType: text(branch?.BranchType),
    openDay: text(branch?.date_opened_variable?.day),
    openMonth: text(branch?.date_opened_variable?.month),
    openYear: text(branch?.date_opened_variable?.year),
    ...emptyAddress(),
  }
  if (branch) addressFrom(m, branch, branch.moved_variable)
  return m
}

onMounted(async () => {
  await Promise.all([options.load(), reference.load(...FORM_LOOKUPS)])
  if (!editing.value) {
    form.value = formFrom()
    return
  }
  try {
    form.value = formFrom(await institutionApi.branch(props.id as string))
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The branch could not be loaded.'))
    await router.replace('/branches')
  }
})

async function save() {
  if (!form.value) return
  invalid.value = missing(form.value, [...REQUIRED, ...ADDRESS_REQUIRED])
  if (invalid.value.length) return void toast.error(REQUIRED_MESSAGE)
  busy.value = true
  showLoader('processing...')
  try {
    if (editing.value) await institutionApi.updateBranch(props.id as string, form.value)
    else await institutionApi.createBranch(form.value)
    hideLoader()
    await router.push('/branches')
    await swalNotification(
      'success',
      editing.value ? 'Branch Updated Successfully' : 'Branch Created Successfully',
    )
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
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/branches" class="text-primary-1">Branches</RouterLink> / {{ editing ? 'Edit' : 'New' }}
    </nav>
    <form v-if="form" class="card p-6" novalidate @submit.prevent="save">
      <ContextForm v-model="form" :invalid="invalid">
        <ProfileRow label="Branch Name"
          ><ProfileInput name="BranchName" placeholder="Branch Name"
        /></ProfileRow>
        <ProfileRow label="Bank Issued Code"
          ><ProfileInput name="bankBranchCode" placeholder="4651"
        /></ProfileRow>
        <ProfileRow label="BOU Issued Code"
          ><ProfileInput name="BranchIdentificationCode" placeholder="001"
        /></ProfileRow>
        <ProfileRow label="Branch Type"
          ><ProfileInput name="BranchType" :options="branchTypes" blank="Select "
        /></ProfileRow>
        <ProfileRow label="Branch Open Date">
          <ProfileDateParts day="openDay" month="openMonth" year="openYear" :from="1920" />
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
