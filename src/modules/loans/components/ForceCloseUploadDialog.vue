<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { messageOf, problemOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import { loansApi } from '../api'
import { errorLines } from '../loanModel'
import type { ForceCloseImportResult } from '../types'

/** "Upload Mopesa Closed Loans Template" (#uploadForceCloseTemplateModal). The import runs while the request is open. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [result: ForceCloseImportResult] }>()

const file = ref<File | null>(null)
const includeInCba = ref(false)
const processing = ref(false)
const progress = ref(0)
const picker = ref<HTMLInputElement | null>(null)

watch(open, (v) => {
  if (!v) return
  file.value = null
  includeInCba.value = false
  processing.value = false
  progress.value = 0
  if (picker.value) picker.value.value = ''
})

async function submit() {
  if (!file.value) return void swalNotification('error', 'Please choose a file to upload.')
  processing.value = true
  progress.value = 0
  try {
    const result = await loansApi.forceCloseUpload(
      file.value,
      includeInCba.value,
      (p) => (progress.value = p),
    )
    open.value = false
    emit('done', result)
  } catch (e) {
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
      await swalNotification('error', errorLines(problem.errors).join('<br>'))
    else await swalNotification('error', messageOf(e, 'An error occurred. Please try again.'))
  } finally {
    processing.value = false
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
        <DialogTitle class="mb-4 text-base font-semibold text-project"
          ><span class="mr-2 text-success">▦</span>Upload Mopesa Closed Loans Template</DialogTitle
        >
        <div class="grid gap-6 md:grid-cols-[7fr_5fr]">
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium" for="fc-template-file">
                File <span class="text-danger">*</span>
              </label>
              <input
                id="fc-template-file"
                ref="picker"
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                class="form-input"
                :disabled="processing"
                @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
              />
              <p class="mt-1 text-xs text-muted">
                <span class="mr-1 rounded bg-success px-1.5 py-0.5 text-white">Tip</span>Save as
                <b>CSV</b> for faster processing of large files.
              </p>
            </div>
            <div>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="includeInCba" type="checkbox" :disabled="processing" /> Include in CBA
              </label>
              <p class="mt-1 text-xs text-muted">
                When unchecked (default), accounts are closed and excluded from the CBA report. When checked,
                accounts are updated and kept in the CBA.
              </p>
            </div>
            <div v-if="processing || progress > 0" data-testid="upload-progress">
              <div class="flex justify-between text-sm">
                <span>Upload progress</span><b>{{ progress }}%</b>
              </div>
              <div class="h-[22px] overflow-hidden rounded bg-slate-200">
                <div
                  class="h-full text-center text-xs leading-[22px] text-white"
                  :class="progress >= 100 ? 'bg-success' : 'bg-amber-500'"
                  :style="{ width: `${progress}%` }"
                >
                  <template v-if="progress > 15">{{ progress }}%</template>
                </div>
              </div>
              <p v-if="processing && progress >= 100" class="mt-1 text-xs text-muted">
                File received — processing the accounts, please wait...
              </p>
            </div>
          </div>
          <div class="card self-start text-sm">
            <div class="border-b border-slate-200 px-4 py-2 font-semibold">Instructions</div>
            <ul class="divide-y divide-slate-100">
              <li class="px-4 py-2">
                <a href="/templates/MOPESA_CLOSED_LOANS_TEMPLATE.xlsx" class="text-primary-1" download
                  >⬇ Download Template</a
                >
              </li>
              <li class="px-4 py-2">Fill in all required columns from the Mopesa closed loans export.</li>
              <li class="px-4 py-2">
                To remove accounts without updating their details, upload a one-column file containing only
                <b>contractCode</b> values. The first row may be a <b>contractCode</b> header.
              </li>
              <li class="px-4 py-2">
                Leave <b>Include in CBA</b> unchecked to close and remove accounts (they won't appear in the
                CBA report). Check it to update accounts and keep them in the CBA. This option is ignored for
                contract-code-only files, which always remove the accounts.
              </li>
              <li class="bg-amber-50 px-4 py-2 text-amber-800">
                ⚠ <b>This action modifies live loan records.</b> Verify the file before uploading.
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="btn-outline" :disabled="processing" @click="open = false">
            × Cancel
          </button>
          <button
            type="button"
            class="btn-primary-1 !bg-success"
            :disabled="processing || !file"
            @click="submit"
          >
            {{ processing ? 'Uploading...' : 'Upload & Process' }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
