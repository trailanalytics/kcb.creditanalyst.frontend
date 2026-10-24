<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { pathOf } from '@/modules/analysis/analysisModel'
import { swalNotification, swalOk } from '@/utils/dialogs'
import { cbaFixApi, TEMPLATE_URLS } from '../api'
import { FIX_TABS, fileLabel, showBarText, uploadFailureHtml, withinLimit, type FixKind } from '../fixModel'

/** One tab of /cba/fix: the upload card (file, progress, button) and the instructions of what the file does. */
const props = defineProps<{ kind: FixKind }>()
const router = useRouter()

const config = computed(() => FIX_TABS[props.kind])
const isDelete = computed(() => props.kind === 'delete')

const file = ref<File | null>(null)
const progress = ref(0)
const processing = ref(false)

// choosing another file starts the progress over
watch(file, () => {
  progress.value = 0
})

const showProgress = computed(() => processing.value || progress.value > 0)
const done = computed(() => progress.value >= 100)

function choose(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function submit() {
  if (!file.value) return void swalNotification('error', 'Please choose a file to upload.')
  if (!withinLimit(file.value, config.value.maxKb)) {
    return void swalNotification('error', `The file may not be greater than ${config.value.maxKb} kilobytes.`)
  }
  processing.value = true
  progress.value = 0
  try {
    const body = new FormData()
    body.append('file', file.value)
    const response = await cbaFixApi.upload(config.value.endpoint, body, (p) => (progress.value = p))
    processing.value = false
    // closing the dialog by any means goes to the background processes page
    await swalOk.fire({
      icon: 'success',
      html: response.message,
      confirmButtonText: 'View Background Process',
    })
    await router.push(pathOf(response.bg_url))
  } catch (e) {
    processing.value = false
    progress.value = 0
    await swalNotification('error', uploadFailureHtml(e))
  }
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-12">
    <form class="card px-6 py-5 md:col-span-7" novalidate @submit.prevent="submit">
      <h3 class="mb-4 text-base font-semibold text-project">
        {{ isDelete ? 'Upload Contract Codes to Delete' : 'Upload Customer Details to Fix' }}
      </h3>

      <label class="mb-1 block text-sm font-medium" :for="`${kind}-file`"
        >File <span class="text-danger">*</span></label
      >
      <label
        :for="`${kind}-file`"
        class="form-input mb-2 block cursor-pointer truncate"
        :class="processing ? 'pointer-events-none opacity-60' : ''"
        >{{ fileLabel(file) }}</label
      >
      <input
        :id="`${kind}-file`"
        type="file"
        class="sr-only"
        :accept="config.accept"
        :disabled="processing"
        :data-testid="`${kind}-file`"
        @change="choose"
      />

      <p v-if="isDelete" class="mb-4 text-xs text-slate-500">
        <span class="mr-1 rounded bg-success px-1.5 py-0.5 font-semibold text-white">Tip</span>
        For large files (100k+ rows) save as <b>CSV</b> before uploading — it's significantly faster.
      </p>
      <div v-else class="mb-4"></div>

      <div v-if="showProgress" class="mb-4" data-testid="progress">
        <div class="mb-1 flex justify-between text-sm">
          <span>Upload progress</span>
          <b>{{ progress }}%</b>
        </div>
        <div class="h-[22px] w-full overflow-hidden rounded bg-slate-200">
          <div
            class="flex h-full items-center justify-center text-xs text-white transition-all"
            :class="done ? 'bg-success' : isDelete ? 'bg-danger' : 'bg-primary-1'"
            :style="{ width: `${progress}%` }"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span v-if="showBarText(progress)">{{ progress }}%</span>
          </div>
        </div>
        <p v-if="done && processing" class="mt-2 text-sm text-muted" data-testid="received">
          File received — queuing background job, please wait...
        </p>
      </div>

      <button
        type="submit"
        class="inline-flex items-center rounded px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        :class="isDelete ? 'bg-danger' : 'bg-primary-1'"
        :disabled="processing || !file"
        data-testid="submit"
      >
        <template v-if="processing">Uploading...</template>
        <template v-else>{{ isDelete ? 'Delete Records' : 'Apply Fixes' }}</template>
      </button>
    </form>

    <div class="card px-6 py-5 text-sm md:col-span-5">
      <h3 class="mb-3 text-base font-semibold text-project">Instructions</h3>
      <ol v-if="isDelete" class="list-decimal space-y-3 pl-5">
        <li>
          <a :href="TEMPLATE_URLS['delete-records']" class="text-primary-1" download>Download template</a>
          — one column: <code>contractCode</code>
        </li>
        <li>
          Fill in one <code>contractCode</code> per row (these are <b>Credit Account Reference</b> values in
          the CBA).
        </li>
        <li>
          For each reference the system will:
          <ul class="mt-1 list-disc space-y-1 pl-5">
            <li>Remove the row from the <code>CBA Report</code></li>
            <li>
              Close the loan account as fully paid (status 4, zero balances) and delete it from the loan
              accounts
            </li>
          </ul>
        </li>
        <li class="rounded bg-amber-50 p-2">
          ⚠ <b>This action is irreversible.</b> Verify the file before uploading.
        </li>
      </ol>
      <ol v-else class="list-decimal space-y-3 pl-5">
        <li>
          <a :href="TEMPLATE_URLS['fix-customer']" class="text-primary-1" download>Download template</a>
          — columns: <code>clientNumber, dob, nin, gender</code>
        </li>
        <li>
          <b>Column mapping:</b>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            <li><code>clientNumber</code> — required, identifies the customer</li>
            <li>
              <code>dob</code> — Date of birth in <code>YYYYMMDD</code> format (e.g. <code>19900115</code>)
            </li>
            <li><code>nin</code> — National ID (II_CountryID), e.g. <code>CM73364876256225GXT</code></li>
            <li><code>gender</code> — <code>0</code> For Male or <code>1</code> For Female</li>
          </ul>
        </li>
        <li>
          Leave <code>dob</code>, <code>nin</code>, or <code>gender</code> <b>blank</b> if you don't want to
          change that field — only non-empty columns are updated. A date of birth that is not a real date, or
          a gender other than 0 or 1, is left out.
        </li>
        <li class="rounded bg-blue-50 p-2">
          Changes are applied to both <code>Customer Profile</code> and all matching rows in the
          <code>CBA Report</code>, so your next CBA export will already reflect the corrected data.
        </li>
      </ol>
    </div>
  </div>
</template>
