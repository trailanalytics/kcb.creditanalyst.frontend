<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DateField from '@/components/ui/DateField.vue'
import DropFile from '@/components/ui/DropFile.vue'
import { swalNotification, swalOk } from '@/utils/dialogs'
import { analysisApi } from './api'
import {
  ACTIONS,
  actionFor,
  pathOf,
  previousMonthEnd,
  uploadBody,
  uploadFailureMessage,
  validateForm,
} from './analysisModel'

/** /analysis: upload the monthly PR4 file, update the loan accounts from it and optionally analyse it against the CBA (PR4.vue). */
const router = useRouter()

const reportingMonth = ref<string | null>(previousMonthEnd())
const exchangeRate = ref('')
const actionValue = ref('')
const file = ref<File | null>(null)
const dropKey = ref(0)
const isProcessing = ref(false)
const uploadProgress = ref(0)
const hasPreviousAnalysis = ref(false)

const action = computed(() => actionFor(actionValue.value))
const analyses = computed(() => action.value.analyze)
const showProgress = computed(() => isProcessing.value || uploadProgress.value > 0)

// choosing another file starts the progress over
watch(file, () => {
  uploadProgress.value = 0
})

onMounted(async () => {
  // the "View Previous Analysis" button only makes sense when there is one
  try {
    hasPreviousAnalysis.value = (await analysisApi.results()) !== null
  } catch {
    hasPreviousAnalysis.value = false
  }
})

async function submit() {
  const problem = validateForm({
    reportingMonth: reportingMonth.value,
    exchangeRate: exchangeRate.value,
    file: file.value,
  })
  if (problem) return void swalNotification('error', problem)

  isProcessing.value = true
  uploadProgress.value = 0
  try {
    const body = uploadBody(
      { reportingMonth: reportingMonth.value, exchangeRate: exchangeRate.value, file: file.value },
      action.value,
    )
    const response = await analysisApi.upload(body, (p) => (uploadProgress.value = p))
    isProcessing.value = false
    // closing the dialog by any means goes to the background processes page, as before
    await swalOk.fire({
      icon: 'success',
      html: response.message,
      confirmButtonText: 'View Background Process',
    })
    await router.push(pathOf(response.bg_url))
  } catch (e) {
    isProcessing.value = false
    uploadProgress.value = 0
    await swalNotification('error', uploadFailureMessage(e))
  }
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Analysis
    </nav>
    <div class="card p-6">
      <div class="grid gap-8 md:grid-cols-3">
        <form class="md:col-span-2" novalidate @submit.prevent="submit">
          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium" for="reporting_month">Submission Date</label>
            <div :class="isProcessing ? 'pointer-events-none opacity-60' : ''" data-testid="reporting-month">
              <DateField v-model="reportingMonth" />
            </div>
          </div>

          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium" for="exchange_rate"
              >Exchange Rate (USD → UGX)</label
            >
            <input
              id="exchange_rate"
              v-model="exchangeRate"
              type="number"
              class="form-input"
              :disabled="isProcessing"
            />
          </div>

          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium" for="actionSelect">Action</label>
            <select id="actionSelect" v-model="actionValue" class="form-input" :disabled="isProcessing">
              <option value="" disabled>-- Select an Action --</option>
              <option v-for="a in ACTIONS" :key="a.value" :value="a.value">{{ a.label }}</option>
            </select>
            <p v-if="analyses" class="mt-1 text-xs text-muted">
              ⓘ The PR4 file will be uploaded <b>and</b> analyzed against the CBA report.
            </p>
          </div>

          <div class="mb-4" :class="isProcessing ? 'pointer-events-none opacity-60' : ''">
            <DropFile
              :key="dropKey"
              accept=".xlsx,.xls,.csv,.txt"
              label="Choose PR4 File (.xlsx or .csv)"
              @file="file = $event"
            />
          </div>

          <div v-if="showProgress" class="mb-4" data-testid="progress">
            <div class="mb-1 flex justify-between text-sm">
              <span>Upload Progress</span>
              <b>{{ uploadProgress }}%</b>
            </div>
            <div class="h-[22px] w-full overflow-hidden rounded bg-slate-200">
              <div
                class="flex h-full items-center justify-center text-xs text-white transition-all"
                :class="uploadProgress === 100 ? 'bg-success' : 'bg-primary-1'"
                :style="{ width: `${uploadProgress}%` }"
                role="progressbar"
                :aria-valuenow="uploadProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span v-if="uploadProgress > 15">{{ uploadProgress }}%</span>
              </div>
            </div>
            <p
              v-if="uploadProgress === 100 && isProcessing"
              class="mt-2 text-sm text-muted"
              data-testid="received"
            >
              File received - processing on server, please wait...
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              class="inline-flex items-center rounded px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              :class="analyses ? 'bg-primary-1' : 'bg-success'"
              :disabled="isProcessing"
              data-testid="submit"
            >
              <template v-if="isProcessing">Processing…</template>
              <template v-else>⬆ {{ action.label }}</template>
            </button>
            <RouterLink v-if="hasPreviousAnalysis" to="/analysis/pr4/results" class="btn-outline">
              View Previous Analysis →
            </RouterLink>
          </div>
        </form>

        <ul class="mt-3 divide-y divide-slate-200 rounded border border-slate-200 text-sm md:mt-0">
          <li class="bg-green-50 p-3">
            <b>⚡ Faster Upload Tip:</b> Open the PR4 Excel file and save it as
            <b>CSV (Comma delimited)</b> before uploading — CSV files process significantly faster than Excel
            files.
          </li>
          <li class="bg-slate-800 p-3 font-bold text-white">ⓘ Analysis Instructions</li>
          <li class="p-3">1. Ensure the CBA file has been generated / downloaded.</li>
          <li class="p-3">
            2. Select the desired <b>Action</b> from the dropdown, then upload the PR4 report.
          </li>
          <li class="p-3">
            3. Choose <i>ANALYZE PR4 AGAINST CBA</i> to run a full comparison after uploading.
          </li>
          <li class="p-3">4. Review the outcome and email it if necessary.</li>
        </ul>
      </div>
    </div>
  </section>
</template>
