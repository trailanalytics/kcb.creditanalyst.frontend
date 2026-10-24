<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { t24Api } from '../api'
import { failureMessage, fieldErrors } from '../logic'
import type { UnsyncedClient } from '../types'

/** "Map Client Numbers": re-key clients created locally to the number T24 gave them (matched by NIN). */
const GUARD =
  'Please select a client to map and supply their T24 client number or check auto map and try again.'

const clients = ref<UnsyncedClient[]>([])
const clientNumber = ref('')
const t24ClientNumber = ref('')
const autoMap = ref(false)
const problem = ref('')
const loadError = ref('')
const busy = ref(false)

async function load() {
  try {
    clients.value = await t24Api.unsynced()
  } catch (e) {
    loadError.value = messageOf(e, 'The clients to map could not be loaded.')
  }
}
onMounted(load)

async function submit() {
  problem.value = ''
  if (!t24ClientNumber.value.trim() && !clientNumber.value && !autoMap.value) {
    problem.value = GUARD
    return
  }
  busy.value = true
  showLoader('syncing...')
  try {
    const result = await t24Api.syncClients({
      clientNumber: clientNumber.value,
      t24ClientNumber: t24ClientNumber.value.trim(),
      autoMap: autoMap.value,
    })
    hideLoader()
    clientNumber.value = ''
    t24ClientNumber.value = ''
    autoMap.value = false
    await swalNotification('success', result.message)
    await load()
  } catch (e) {
    hideLoader()
    const fields = fieldErrors(e)
    problem.value = fields.clientNumber ?? ''
    const message = failureMessage(e, 'Failed to process your request!')
    if (message && !problem.value) await swalNotification('error', message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="border-b border-slate-200 px-4 py-2 text-sm font-medium">Synchronize T24 Client Numbers</div>
    <div class="p-4">
      <form class="max-w-xl space-y-4" novalidate @submit.prevent="submit">
        <p v-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>
        <select v-model="clientNumber" class="form-input" aria-label="Client to map">
          <option value="">--- select ---</option>
          <option v-for="c in clients" :key="c.id" :value="`${c.client_number}::${c.nin}`">
            {{ c.full_name }}
          </option>
        </select>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">T24 Client Number</span>
          <input v-model="t24ClientNumber" class="form-input" autocomplete="off" name="t24ClientNumber" />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="autoMap" type="checkbox" name="autoMap" />
          Auto Map
        </label>
        <p v-if="problem" class="text-sm text-danger" role="alert">{{ problem }}</p>
        <button
          type="submit"
          class="rounded bg-ink px-3 py-1.5 text-xs uppercase text-white disabled:opacity-60"
          :disabled="busy"
        >
          MAP CLIENTS
        </button>
      </form>
    </div>
  </div>
</template>
