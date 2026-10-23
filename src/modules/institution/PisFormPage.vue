<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import ProfileForm from '@/modules/customer/components/ProfileForm.vue'
import ProfileInput from '@/modules/customer/components/ProfileInput.vue'
import ProfileRow from '@/modules/customer/components/ProfileRow.vue'
import { CLASSIFICATIONS, useProfileOptions, type Opt } from '@/modules/customer/options'
import { emptyProfile, profileFrom } from '@/modules/customer/profileModel'
import type { Customer, ProfileModel } from '@/modules/customer/types'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { institutionApi } from './api'
import { FORM_LOOKUPS } from './addressModel'
import ContextForm from './components/ContextForm.vue'
import { checkEmbedded } from './embeddedProfile'
import { showFailure } from './failure'

/**
 * /proflie/new/pis (also /pis/new) and /edit/pis/{id}: the stakeholder's percentage and category with the customer's profile
 * (pis/create.blade.php, edit.blade.php). `?profile=<clientNumber>` starts from an existing customer.
 */
const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const options = useProfileOptions()
const reference = useReferenceStore()
const editing = computed(() => props.id !== undefined)

const form = ref<ProfileModel | null>(null)
const invalid = ref<string[]>([])
const busy = ref(false)
// the profile of an existing customer keeps its classification; changing it is done on the profile page
const existing = ref(false)
const categories = computed<Opt[]>(() =>
  reference.items('stakeholder-categories').map((i) => ({ value: i.code, label: i.value })),
)

async function unknown(message: string) {
  await router.replace('/pis')
  await swalNotification('error', message)
}

function withProfile(customer: Customer | null, percentage = '', category = ''): ProfileModel {
  const base = customer ? profileFrom(customer) : emptyProfile('0')
  existing.value = customer !== null
  return {
    ...base,
    ShareholderPercentage: percentage,
    StakeholderCategory: category,
    profile_id: customer ? String(customer.id) : '',
  }
}

onMounted(async () => {
  await Promise.all([options.load(), reference.load(...FORM_LOOKUPS)])
  try {
    if (editing.value) {
      const stakeholder = await institutionApi.stakeholder(props.id as string)
      if (!stakeholder.customer)
        return void (await unknown('The profile of this stakeholder no longer exists.'))
      form.value = withProfile(
        stakeholder.customer,
        stakeholder.ShareholderPercentage ?? '',
        stakeholder.StakeholderCategory ?? '',
      )
      return
    }
    const clientNumber = typeof route.query.profile === 'string' ? route.query.profile : ''
    if (!clientNumber) {
      form.value = withProfile(null)
      return
    }
    const customer = await institutionApi.profileByCif(clientNumber)
    if (!customer) return void (await unknown('Unknown Profile'))
    form.value = withProfile(customer)
  } catch (e) {
    await unknown(messageOf(e, 'The record could not be loaded.'))
  }
})

async function save() {
  if (!form.value) return
  const check = checkEmbedded(form.value, ['ShareholderPercentage', 'StakeholderCategory'])
  invalid.value = check.invalid
  if (check.message) return void toast.error(check.message)
  busy.value = true
  showLoader('processing...')
  try {
    if (editing.value) await institutionApi.updateStakeholder(props.id as string, form.value)
    else await institutionApi.createStakeholder(form.value)
    hideLoader()
    await router.push('/pis')
    await swalNotification('success', 'PIS Saved Successfully')
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
      <RouterLink to="/pis" class="text-primary-1">PIS</RouterLink> / {{ editing ? 'Edit' : 'New' }}
    </nav>
    <form v-if="form" class="card" novalidate @submit.prevent="save">
      <div class="border-b border-slate-200 px-6 py-3 font-semibold">
        {{ editing ? 'Update PIS Record' : 'New PIS Record' }}
      </div>
      <div class="p-6">
        <ContextForm v-model="form" :invalid="invalid">
          <ProfileRow label="Shareholder Percentage">
            <ProfileInput name="ShareholderPercentage" placeholder="Shareholder Percentage" />
          </ProfileRow>
          <ProfileRow label="Stakeholder Category">
            <ProfileInput name="StakeholderCategory" :options="categories" blank="Select Category" />
          </ProfileRow>
          <h3 class="mb-1 mt-8 text-lg text-muted">Profile</h3>
          <hr class="mb-4" />
          <ProfileRow label="Classification">
            <ProfileInput
              name="classificationCode"
              :options="CLASSIFICATIONS"
              :disabled="existing"
              width="w-1/2"
            />
          </ProfileRow>
          <ProfileRow label="Branch Code">
            <ProfileInput name="branchCode" :options="options.branches.value" blank="Select Branch" />
          </ProfileRow>
          <ProfileForm v-model="form" embedded :invalid="invalid" />
        </ContextForm>
      </div>
      <div class="flex justify-center border-t border-slate-200 px-6 py-4">
        <button type="submit" class="btn-system w-full md:w-1/4" :disabled="busy">Save</button>
      </div>
    </form>
    <p v-else class="py-8 text-center text-sm text-muted">loading…</p>
  </section>
</template>
