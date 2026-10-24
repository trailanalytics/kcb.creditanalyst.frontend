<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import { blobFailure, filenameOf, saveBlob } from '@/modules/loans/download'
import { hideLoader, showLoader, swalNotification, swalOk, toast } from '@/utils/dialogs'
import DateSelects from './components/DateSelects.vue'
import { reportsApi } from './api'
import { REPORT_TYPES, buildRequest, fallbackFileName, initialForm, visibility } from './reportModel'

/** /reports/crb: the Credit Bureau Reports form (reports/tabs/crb-reports.blade.php). */
const router = useRouter()
const form = reactive(initialForm())
const busy = ref(false)
const show = computed(() => visibility(form.fileName))

/** A dialog with a button to the Background Processes page, where the CBA file is followed and downloaded. */
async function offerProgress(icon: 'success' | 'error', html: string) {
  const answer = await swalOk.fire({
    icon,
    html,
    confirmButtonText: 'View Progress →',
    showCancelButton: true,
    cancelButtonText: 'Stay here',
    reverseButtons: true,
  })
  if (answer.isConfirmed) await router.push('/background-processes')
}

async function queueCba(body: Parameters<typeof reportsApi.generateCba>[0]) {
  try {
    await reportsApi.generateCba(body)
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      await offerProgress('error', messageOf(e, 'A CBA generation or cleanup is already running.'))
    } else {
      await swalNotification('error', failureText(e))
    }
    return
  }
  await offerProgress('success', 'CBA report generation has been queued and is running in the background.')
}

function failureText(e: unknown): string {
  const problem = problemOf(e)
  const lines = problem?.errors ? Object.values(problem.errors).flat() : []
  return lines.length ? lines.join('<br>') : messageOf(e, 'The report could not be generated.')
}

async function downloadFile(
  type: Parameters<typeof reportsApi.download>[0],
  body: Parameters<typeof reportsApi.download>[1],
) {
  showLoader('Generating the report, please wait...')
  try {
    const response = await reportsApi.download(type, body)
    saveBlob(response.data, filenameOf(response.headers, fallbackFileName(type, body.toDate)))
    hideLoader()
    toast.success('The report has been generated.')
  } catch (e) {
    hideLoader()
    toast.error(await blobFailure(e, 'The report could not be generated.'))
  }
}

async function submit() {
  const built = buildRequest(form)
  if ('error' in built) return void swalNotification('error', built.error)
  busy.value = true
  try {
    if (built.request.kind === 'cba') await queueCba(built.request.body)
    else await downloadFile(built.request.type, built.request.body)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section>
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CRB Reports
    </nav>
    <div class="card max-w-4xl">
      <div class="border-b border-slate-200 px-4 py-1 font-medium">Credit Bureau Reports</div>
      <form class="px-4 py-10" novalidate @submit.prevent="submit">
        <div class="mb-4 flex items-center gap-4">
          <label for="file_name" class="w-1/4 text-right text-sm">Report Type</label>
          <select id="file_name" v-model="form.fileName" name="file_name" class="form-input flex-1" required>
            <option v-for="t in REPORT_TYPES" :key="t.value" :value="t.value" :disabled="t.disabled">
              {{ t.label }}
            </option>
          </select>
        </div>

        <div v-show="show.from" class="mb-4 flex items-center gap-4" data-testid="from-block">
          <span class="w-1/4 text-right text-sm">From</span>
          <div class="flex-1"><DateSelects v-model="form.from" name="from" label="From" /></div>
        </div>

        <div v-show="show.to" class="mb-4 flex items-center gap-4" data-testid="to-block">
          <span class="w-1/4 text-right text-sm">To</span>
          <div class="flex-1"><DateSelects v-model="form.to" name="to" label="To" /></div>
        </div>

        <div v-show="show.version" class="mb-4 flex items-center gap-4" data-testid="version-block">
          <label for="version" class="w-1/4 text-right text-sm">Version</label>
          <select id="version" v-model="form.version" name="version" class="form-input flex-1" required>
            <option value="8.0">8.0</option>
          </select>
        </div>

        <div v-show="show.shortCba" class="mb-4 flex items-center gap-4" data-testid="short-cba">
          <span class="w-1/4"></span>
          <label class="flex flex-1 items-center gap-2 text-sm">
            <input v-model="form.useCachedCba" type="checkbox" name="use_cached_cba" />
            Download Short CBA
          </label>
        </div>

        <div v-show="show.instruments" class="mb-4 flex items-start gap-4" data-testid="instruments">
          <span class="w-1/4"></span>
          <label class="flex flex-1 items-start gap-2 text-sm">
            <input
              v-model="form.useInstrumentsCodes"
              type="checkbox"
              name="use_instruments_codes"
              class="mt-1"
            />
            <span>
              Include instruments of claim codes in the report instead of text values
              <small class="block font-bold text-primary-1"
                >(only choose this option if the Bureau requires instruments of claim codes)</small
              >
            </span>
          </label>
        </div>

        <div class="flex items-center gap-4">
          <span class="w-1/4"></span>
          <div class="flex-1">
            <button type="submit" class="btn-primary-1 w-1/2" :disabled="busy" data-testid="download">
              Download Report
            </button>
          </div>
        </div>
      </form>
      <div class="border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm text-muted">
        Note: some reports like CBA are heavy and therefore take longer to download!
      </div>
    </div>
  </section>
</template>
