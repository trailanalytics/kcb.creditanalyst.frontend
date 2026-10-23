<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { messageOf, problemOf } from '@/api/http'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { loansApi } from '../api'
import { asText, blankForceClose, isBlankRow, removeRow, rowErrorLines } from '../loanModel'
import type { ForceCloseEntry } from '../types'

/** "Force Close Loan Accounts": one row per loan to close as fully paid (the #forceCloseLoanAccounts modal). */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const rows = ref<ForceCloseEntry[]>([blankForceClose()])

watch(open, (v) => {
  if (v) rows.value = [blankForceClose()]
})

async function save() {
  const filled = rows.value.filter((r) => !isBlankRow(r)).map(asText)
  if (!filled.length) return void swalNotification('error', 'Enter at least one loan account to force close.')
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'You are about to force close loan accounts. These accounts will appear in the CBA as fully paid. Proceed?',
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('saving...')
  try {
    const result = await loansApi.forceClose(filled)
    hideLoader()
    open.value = false
    await swalNotification('success', result.message)
    emit('saved')
  } catch (e) {
    hideLoader()
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
      await swalNotification('error', rowErrorLines(problem.errors).join('<br>'))
    else await swalNotification('error', messageOf(e, 'Error while saving closed loan accounts!'))
  }
}
</script>

<template>
  <!-- not modal: a modal dialog blocks clicks on the SweetAlert boxes this form opens over itself -->
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" aria-hidden="true" @click="open = false"></div>
      <DialogContent
        class="fixed left-1/2 top-12 z-50 w-[min(60rem,95vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-3 text-base font-semibold text-project">Force Close Loan Accounts</DialogTitle>
        <div class="max-h-[550px] overflow-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead class="text-xs uppercase text-muted">
              <tr>
                <th class="border p-2">Contract Code</th>
                <th class="border p-2">Closure Date</th>
                <th class="border p-2">Closure Reason</th>
                <th class="border p-2">Last Payment Date</th>
                <th class="border p-2" colspan="2">Last Payment Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i" data-testid="force-close-row">
                <td class="border p-1">
                  <input
                    v-model="r.contractCode"
                    class="form-input"
                    placeholder="eg AA182560YBCR"
                    :aria-label="`Contract code, row ${i + 1}`"
                  />
                </td>
                <td class="border p-1">
                  <input
                    v-model="r.creditAccountClosureDate"
                    type="date"
                    class="form-input"
                    :aria-label="`Closure date, row ${i + 1}`"
                  />
                </td>
                <td class="border p-1">
                  <input
                    v-model="r.creditAccountClosureReason"
                    type="number"
                    min="2"
                    max="4"
                    class="form-input"
                    placeholder="eg 2"
                    :aria-label="`Closure reason, row ${i + 1}`"
                  />
                </td>
                <td class="border p-1">
                  <input
                    v-model="r.lastPaymentDate"
                    type="date"
                    class="form-input"
                    :aria-label="`Last payment date, row ${i + 1}`"
                  />
                </td>
                <td class="border p-1">
                  <input
                    v-model="r.lastPaymentAmount"
                    type="number"
                    min="1"
                    class="form-input"
                    :aria-label="`Last payment amount, row ${i + 1}`"
                  />
                </td>
                <td class="w-10 border p-1 text-center">
                  <button
                    v-if="i > 0"
                    type="button"
                    class="text-danger"
                    :aria-label="`Remove row ${i + 1}`"
                    @click="rows = removeRow(rows, i)"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="btn-outline" @click="open = false">× Cancel</button>
          <button type="button" class="btn-primary-1" @click="rows.push(blankForceClose())">
            + Add More
          </button>
          <button type="button" class="btn-primary-1 !bg-success" @click="save">Save changes</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
