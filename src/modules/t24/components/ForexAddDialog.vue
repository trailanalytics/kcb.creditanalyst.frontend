<script setup lang="ts">
import { ref, watch } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { t24Api } from '../api'
import { failureMessage, fieldErrors, previousMonthEnd, rateProblem } from '../logic'

/** The "Forex Rate" modal: a rate for USD or KES at the end of the previous month. Adding the same pair again replaces it. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const currency = ref('USD')
const ugx = ref('')
const monthEnding = ref(previousMonthEnd())
const errors = ref<Record<string, string>>({})

watch(open, (v) => {
  if (v) {
    currency.value = 'USD'
    ugx.value = ''
    monthEnding.value = previousMonthEnd()
    errors.value = {}
  }
})

async function save() {
  errors.value = {}
  if (!currency.value) errors.value.currency = 'Select a currency.'
  const problem = rateProblem(ugx.value)
  if (problem) errors.value.ugx = problem
  if (Object.keys(errors.value).length) return
  showLoader('saving...')
  try {
    const result = await t24Api.addForexRate({
      currency: currency.value,
      ugx: ugx.value.trim().replace(/,/g, ''),
      month_ending: monthEnding.value,
    })
    hideLoader()
    open.value = false
    await swalNotification('success', result.message)
    emit('saved')
  } catch (e) {
    hideLoader()
    errors.value = fieldErrors(e)
    const message = failureMessage(e, 'Failed to save changes!')
    if (message && !Object.keys(errors.value).length) await swalNotification('error', message)
  }
}
</script>

<template>
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" aria-hidden="true" @click="open = false"></div>
      <DialogContent
        class="fixed left-1/2 top-24 z-50 w-[min(28rem,95vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-4 text-base font-semibold text-project">Forex Rate</DialogTitle>
        <form class="space-y-4" novalidate @submit.prevent="save">
          <label class="block text-sm">
            <span class="mb-1 block font-medium">Currency:</span>
            <select v-model="currency" class="form-input" :class="{ 'is-invalid': errors.currency }">
              <option value="">--- select ---</option>
              <option value="USD">USD</option>
              <option value="KES">KES</option>
            </select>
            <span v-if="errors.currency" class="text-xs text-danger">{{ errors.currency }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium">UGX Equivalent:</span>
            <input
              v-model="ugx"
              class="form-input"
              :class="{ 'is-invalid': errors.ugx }"
              inputmode="decimal"
              placeholder="0"
              name="ugx"
            />
            <span v-if="errors.ugx" class="text-xs text-danger">{{ errors.ugx }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium">Month Ending:</span>
            <input v-model="monthEnding" class="form-input" readonly name="month_ending" />
            <span v-if="errors.month_ending" class="text-xs text-danger">{{ errors.month_ending }}</span>
          </label>
          <div class="flex justify-end">
            <button type="submit" class="rounded bg-success px-4 py-2 text-sm font-medium text-white">
              Save changes
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
