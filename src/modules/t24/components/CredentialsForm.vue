<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { expiryLine, failureMessage, fieldErrors } from '../logic'
import type { CredentialsBody, DatabaseStatus, MessageResponse } from '../types'

/**
 * The warehouse (T24 DWH) login: username, password and the date the password expires. The saved password is never sent to
 * the browser, so the password field starts empty and an empty field on save keeps the stored one.
 */
const props = defineProps<{
  status: DatabaseStatus
  canUpdate: boolean
  save: (body: CredentialsBody) => Promise<MessageResponse>
  button?: string
}>()
const emit = defineEmits<{ saved: [] }>()

const form = reactive<CredentialsBody>({ username: '', password: '', expiry_date: '' })
const errors = ref<Record<string, string>>({})
const busy = ref(false)

watch(
  () => props.status,
  (s) => {
    form.username = s.username ?? ''
    form.expiry_date = s.expiry_date ?? ''
    form.password = ''
  },
  { immediate: true },
)

async function submit() {
  errors.value = {}
  showLoader('processing...')
  busy.value = true
  try {
    const result = await props.save({ ...form })
    form.password = ''
    hideLoader()
    await swalNotification('success', result.message)
    emit('saved')
  } catch (e) {
    hideLoader()
    errors.value = fieldErrors(e)
    const message = failureMessage(e, 'Failed to process your request!')
    if (message) await swalNotification('error', message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="max-w-xl space-y-4" novalidate @submit.prevent="submit">
    <p class="text-xs text-muted" data-testid="expiry-line">{{ expiryLine(status) }}</p>
    <p v-if="!canUpdate" class="rounded bg-slate-100 px-3 py-2 text-sm text-muted" role="note">
      You may view these details but not change them. Updating the login needs the Update T24 Credentials
      permission.
    </p>
    <div class="grid gap-4 md:grid-cols-2">
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Username</span>
        <input
          v-model="form.username"
          class="form-input"
          :class="{ 'is-invalid': errors.username }"
          :readonly="!canUpdate"
          autocomplete="off"
          name="username"
        />
        <span v-if="errors.username" class="text-xs text-danger">{{ errors.username }}</span>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">Password</span>
        <input
          v-model="form.password"
          type="password"
          class="form-input"
          :class="{ 'is-invalid': errors.password }"
          :readonly="!canUpdate"
          :placeholder="status.configured ? 'Leave blank to keep the current password' : ''"
          autocomplete="new-password"
          name="password"
        />
        <span v-if="errors.password" class="text-xs text-danger">{{ errors.password }}</span>
      </label>
    </div>
    <label class="block text-sm">
      <span class="mb-1 block font-medium">Expiry Date</span>
      <input
        v-model="form.expiry_date"
        type="date"
        class="form-input"
        :class="{ 'is-invalid': errors.expiry_date }"
        :readonly="!canUpdate"
        name="expiry_date"
      />
      <span v-if="errors.expiry_date" class="text-xs text-danger">{{ errors.expiry_date }}</span>
    </label>
    <button v-if="canUpdate" type="submit" class="btn-system" :disabled="busy">
      {{ button ?? 'UPDATE CREDENTIALS' }}
    </button>
  </form>
</template>
