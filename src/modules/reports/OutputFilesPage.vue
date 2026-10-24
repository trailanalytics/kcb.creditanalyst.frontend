<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { AxiosResponse } from 'axios'
import { messageOf } from '@/api/http'
import { blobFailure, filenameOf, saveBlob } from '@/modules/loans/download'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import OutputFilesTable from './components/OutputFilesTable.vue'
import { outputFilesApi } from './api'
import { REPORT_FILTER_TYPES, convertProblem, extractProblem } from './outputModel'
import type { OutputFileRow } from './types'

/** /output-files: files kept after submission, the Bureau feedback filter and the Excel to CSV converter (outputFiles/index.blade.php). */
const rows = ref<OutputFileRow[]>([])
const reportType = ref('')
const version = ref('8.0')
const ruleName = ref('')
const feedbackFile = ref<File | null>(null)
const excelFile = ref<File | null>(null)
const excelVersion = ref('')
const busy = ref(false)

async function refresh() {
  try {
    rows.value = await outputFilesApi.list()
  } catch (e) {
    toast.error(messageOf(e, 'The output files could not be loaded.'))
  }
}
onMounted(refresh)

const pick = (target: EventTarget | null) => (target as HTMLInputElement).files?.[0] ?? null

async function run(title: string, call: () => Promise<AxiosResponse<Blob>>, fallback: string, name: string) {
  busy.value = true
  showLoader(title)
  try {
    const response = await call()
    saveBlob(response.data, filenameOf(response.headers, name))
    hideLoader()
    return true
  } catch (e) {
    hideLoader()
    await swalNotification('error', await blobFailure(e, fallback))
    return false
  } finally {
    busy.value = false
  }
}

async function download(row: OutputFileRow) {
  await run(
    'downloading...',
    () => outputFilesApi.download(row.id),
    'The file is no longer available.',
    row.download_name,
  )
  await refresh()
}

async function extract() {
  const problem = extractProblem({
    reportType: reportType.value,
    ruleName: ruleName.value,
    file: feedbackFile.value,
  })
  if (problem) return void swalNotification('error', problem)
  const form = new FormData()
  form.append('report_type', reportType.value)
  form.append('version', version.value)
  form.append('rule_name', ruleName.value.trim())
  form.append('output_file', feedbackFile.value as File)
  const ok = await run(
    'extracting the affected records...',
    () => outputFilesApi.extract(form),
    'The affected records could not be extracted.',
    `${ruleName.value.trim()}.xlsx`,
  )
  // the file is kept in the list for 15 days, so the new row is shown without a manual reload
  if (ok) await refresh()
}

async function convert() {
  const problem = convertProblem(excelFile.value)
  if (problem) return void swalNotification('error', problem)
  const form = new FormData()
  form.append('version', excelVersion.value)
  form.append('excel_file', excelFile.value as File)
  await run(
    'converting...',
    () => outputFilesApi.convertExcel(form),
    'The file could not be converted.',
    'converted.csv',
  )
}
</script>

<template>
  <section>
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Output Files
    </nav>

    <OutputFilesTable v-if="rows.length" :rows="rows" @download="download" />

    <div class="mt-3 grid gap-4 md:grid-cols-12">
      <form class="card px-6 py-5 md:col-span-8" novalidate @submit.prevent="extract">
        <h2 class="mb-4 font-medium">Upload CSV Output File</h2>
        <div class="mb-3">
          <select
            v-model="reportType"
            class="form-input"
            required
            aria-label="Report type"
            name="report_type"
          >
            <option value="">--Select Report Type--</option>
            <option v-for="[value, label] in REPORT_FILTER_TYPES" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="mb-3">
          <select v-model="version" class="form-input" aria-label="Version" name="version">
            <option value="">--Select Version--</option>
            <option value="8.0">8.0</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="mb-1 block text-sm" for="output_file">Choose output file</label>
          <input
            id="output_file"
            type="file"
            accept=".csv"
            class="form-input"
            name="output_file"
            @change="feedbackFile = pick($event.target)"
          />
        </div>
        <div class="mb-3">
          <label class="mb-1 block text-sm" for="rule_name">Rule Name</label>
          <input
            id="rule_name"
            v-model="ruleName"
            type="text"
            class="form-input"
            placeholder="eg CBA_399"
            maxlength="20"
            name="rule_name"
          />
        </div>
        <button type="submit" class="btn-primary-1" :disabled="busy" data-testid="extract">
          Get Affected Records
        </button>
      </form>

      <form class="card px-6 py-5 md:col-span-4" novalidate @submit.prevent="convert">
        <h2 class="mb-4 font-medium">Convert Excel To CRB CSV File</h2>
        <div class="mb-3">
          <select v-model="excelVersion" class="form-input" aria-label="Conversion version" name="version">
            <option value="">--Select Version--</option>
            <option value="8.0">8.0</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="mb-1 block text-sm" for="excel_file">Choose Excel File</label>
          <input
            id="excel_file"
            type="file"
            accept=".xlsx"
            class="form-input"
            name="excel_file"
            @change="excelFile = pick($event.target)"
          />
        </div>
        <button type="submit" class="btn-primary-1" :disabled="busy" data-testid="convert">
          Convert to CSV
        </button>
      </form>
    </div>
  </section>
</template>
