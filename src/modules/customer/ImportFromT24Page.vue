<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { messageOf } from '@/api/http'
import { profilesApi } from './api'
import type { Customer } from './types'

/** /find-in-t24: look a client up by client or account number (borrowers/force_find.blade.php). */
const search = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const profile = ref<Customer | null>(null)

async function find() {
  const q = search.value.trim()
  if (!q) return
  busy.value = true
  error.value = null
  profile.value = null
  try {
    const result = await profilesApi.forceFind(q)
    profile.value = result.profile
  } catch (e) {
    error.value = axios.isAxiosError(e) && e.response?.status === 404 ? e.response.data.message : messageOf(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <h1 class="mb-4 text-xl font-semibold text-project">Profiles</h1>
    <form class="card mb-4 p-6" @submit.prevent="find">
      <label for="t24-search" class="mb-2 block text-sm">Search by Client Number or Account Number</label>
      <div class="flex gap-3">
        <input id="t24-search" v-model="search" class="form-input flex-1" type="text" name="search" />
        <button type="submit" class="btn-primary-1 px-8" :disabled="busy">Find</button>
      </div>
    </form>

    <div
      v-if="error"
      role="alert"
      class="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <template v-if="error.startsWith('Failed!')"><b>Failed!</b>{{ error.slice(7) }}</template>
      <template v-else>{{ error }}</template>
    </div>

    <template v-if="profile">
      <div role="status" class="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <b>Success!</b> The following record has been imported from T24 to credit analyst
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Borrower</th>
              <th class="px-4 py-3">Client No</th>
              <th class="px-4 py-3">FCS No</th>
              <th class="px-4 py-3">Classification</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr class="border-t border-slate-100">
              <td class="px-4 py-3">
                <RouterLink :to="`/borrowers/${profile.id}`" class="font-medium text-project">{{
                  profile.full_name.trim() || 'Unnamed customer'
                }}</RouterLink>
                <div class="text-xs text-muted">Running Loans: 00</div>
              </td>
              <td class="px-4 py-3">{{ profile.clientNumber }}</td>
              <td class="px-4 py-3">{{ profile.II_FCSNumber }}</td>
              <td class="px-4 py-3">{{ profile.customer_type }}</td>
              <td class="px-4 py-3 text-right">
                <RouterLink :to="`/applications/create/${profile.clientNumber}`" class="btn-outline"
                  >New Loan</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
