<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { t24Api } from '../api'
import { dateLabel, failureMessage, rateProblem } from '../logic'
import type { ForexRate } from '../types'
import ForexAddDialog from './ForexAddDialog.vue'

/** "Forex Rates": the rates of the last four months. Click a rate to edit it in place; Enter saves, Escape cancels. */
const rates = ref<ForexRate[]>([])
const loadError = ref('')
const adding = ref(false)
const editingId = ref<number | null>(null)
const editValue = ref('')
const editProblem = ref('')
const input = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

async function load() {
  try {
    rates.value = await t24Api.forexRates()
    loadError.value = ''
  } catch (e) {
    loadError.value = messageOf(e, 'The forex rates could not be loaded.')
  }
}
onMounted(load)

async function edit(rate: ForexRate) {
  editingId.value = rate.id
  editValue.value = String(rate.ugx_equivalent)
  editProblem.value = ''
  await nextTick()
  const el = Array.isArray(input.value) ? input.value[0] : input.value
  el?.focus()
}

function cancel() {
  editingId.value = null
  editProblem.value = ''
}

async function saveEdit(rate: ForexRate) {
  const problem = rateProblem(editValue.value)
  if (problem) {
    editProblem.value = problem
    return
  }
  showLoader('saving...')
  try {
    const result = await t24Api.updateForexRate(rate.id, editValue.value.trim().replace(/,/g, ''))
    hideLoader()
    cancel()
    await swalNotification('success', result.message)
    await load()
  } catch (e) {
    hideLoader()
    const message = failureMessage(e, 'Failed to save changes!')
    if (message) await swalNotification('error', message)
  }
}
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2">
      <h5 class="text-base font-medium">Forex Rates</h5>
      <button
        type="button"
        class="rounded bg-success px-3 py-1.5 text-xs font-medium text-white"
        @click="adding = true"
      >
        &#8853; Add Rate
      </button>
    </div>
    <div class="p-4">
      <p v-if="loadError" class="mb-2 text-sm text-danger" role="alert">{{ loadError }}</p>
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase text-muted">
          <tr>
            <th class="p-2">Currency</th>
            <th class="p-2">UGX Equivalent</th>
            <th class="p-2">Rate as at</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rates" :key="r.id" class="odd:bg-slate-50" data-testid="forex-row">
            <td class="p-2">{{ r.currency }}</td>
            <td class="p-2">
              <template v-if="editingId === r.id">
                <input
                  ref="input"
                  v-model="editValue"
                  class="w-40 border-0 border-b-2 border-success bg-transparent px-1 py-0.5 text-sm focus:outline-none"
                  inputmode="decimal"
                  :aria-label="`UGX equivalent of ${r.currency}`"
                  @keydown.enter.prevent="saveEdit(r)"
                  @keydown.esc.prevent="cancel"
                />
                <small class="block text-xs text-muted">Press enter when done. Esc cancels.</small>
                <small v-if="editProblem" class="block text-xs text-danger" role="alert">{{
                  editProblem
                }}</small>
              </template>
              <button
                v-else
                type="button"
                class="text-ink hover:underline"
                :aria-label="`Edit ${r.currency} rate`"
                @click="edit(r)"
              >
                {{ Number(r.ugx_equivalent).toFixed(2) }} &nbsp; &#9998;
              </button>
            </td>
            <td class="p-2">{{ dateLabel(r.month_ending) }}</td>
          </tr>
          <tr v-if="!rates.length && !loadError">
            <td colspan="3" class="p-2 text-muted">No rates in the last four months.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <ForexAddDialog v-model:open="adding" @saved="load" />
  </div>
</template>
