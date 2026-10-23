<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { profilesApi } from './api'
import { confirmClassificationChange } from './classification'
import ProfileForm from './components/ProfileForm.vue'
import { profileFrom } from './profileModel'
import { checkProfile, TRADING_NAME_MESSAGE } from './profileRules'
import { NON_INDIVIDUAL, type Customer, type ProfileModel } from './types'

/** /borrowers/edit/{id}: edit the profile (borrowers/edit.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const customer = ref<Customer | null>(null)
const form = ref<ProfileModel | null>(null)
const invalid = ref<string[]>([])
const busy = ref(false)

async function load() {
  try {
    customer.value = await profilesApi.get(props.id)
    form.value = profileFrom(customer.value)
    invalid.value = []
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The profile could not be loaded.'))
    await router.replace('/profiles')
  }
}
onMounted(load)

async function classificationChanged(value: string) {
  if (!customer.value || !form.value) return
  const current = customer.value.classificationCode ?? '0'
  if (value === current) return
  const changed = await confirmClassificationChange(customer.value.clientNumber, current)
  if (changed) await load()
  else if (form.value) form.value.classificationCode = current
}

async function save() {
  if (!form.value || !customer.value) return
  const check = checkProfile(form.value)
  invalid.value = check.invalid
  if (check.message) return void toast.error(check.message)
  if (form.value.classificationCode === NON_INDIVIDUAL && !(form.value.GSCAFB_TradingName ?? '').trim())
    return void swalNotification('error', TRADING_NAME_MESSAGE)

  busy.value = true
  showLoader('processing...')
  try {
    customer.value = await profilesApi.update(customer.value.id, form.value)
    form.value = profileFrom(customer.value)
    hideLoader()
    toast.success(' Profile Updated Successfully')
  } catch (e) {
    const problem = problemOf(e)
    const detail =
      axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors
        ? Object.values(problem.errors).flat().join('<br>')
        : messageOf(e)
    await swalNotification('error', detail)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="form" class="mx-auto max-w-5xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/profiles" class="text-primary-1">Profiles</RouterLink> / Edit
    </nav>
    <form id="edit-cap-form" class="card p-6" novalidate @submit.prevent="save">
      <ProfileForm v-model="form" :invalid="invalid" @classification-change="classificationChanged" />
      <div class="mt-8 flex justify-center">
        <button type="submit" class="btn-system w-full md:w-1/4" :disabled="busy">Save</button>
      </div>
    </form>
  </section>
</template>
