<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { t24Api } from '../api'
import type { DatabaseStatus } from '../types'
import CredentialsForm from './CredentialsForm.vue'

/** "T24 Password": the warehouse login, saved after a live test login. */
const auth = useAuthStore()
const status = ref<DatabaseStatus | null>(null)
const error = ref('')
const canUpdate = computed(() => auth.has('Update T24 Credentials'))

async function load() {
  try {
    status.value = await t24Api.database()
  } catch (e) {
    error.value = messageOf(e, 'The saved credentials could not be loaded.')
  }
}
onMounted(load)
</script>

<template>
  <div class="card">
    <div class="border-b border-slate-200 px-4 py-2 text-sm font-medium">Update T24 User Password</div>
    <div class="p-4">
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <p v-else-if="!status" class="text-sm text-muted">loading…</p>
      <CredentialsForm
        v-else
        :status="status"
        :can-update="canUpdate"
        :save="t24Api.saveCredentials"
        @saved="load"
      />
    </div>
  </div>
</template>
