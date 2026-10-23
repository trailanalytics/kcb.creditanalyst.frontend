<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DateField from '@/components/ui/DateField.vue'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { applicationsApi } from './api'

/** /applications/report: "EXPORT APPLICATIONS" (cap/report.blade.php). */
const ref_ = useReferenceStore()
const form = reactive({
  status: '',
  from_date: null as string | null,
  to_date: null as string | null,
  branch: '',
})
const busy = ref(false)
onMounted(() => ref_.load('branches'))

async function download() {
  busy.value = true
  showLoader('preparing the report...')
  try {
    const params: Record<string, string> = {}
    if (form.status) params.status = form.status
    if (form.from_date) params.from_date = form.from_date
    if (form.to_date) params.to_date = form.to_date
    if (form.branch) params.branch = form.branch
    const response = await applicationsApi.report(params)
    const name =
      /filename="?([^";]+)"?/.exec(String(response.headers['content-disposition'] ?? ''))?.[1] ??
      'applications.xlsx'
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    hideLoader()
  } catch {
    await swalNotification('error', 'The report could not be downloaded.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/applications" class="text-primary-1">CAP</RouterLink> / Report
    </nav>
    <form class="card space-y-4 p-6" @submit.prevent="download">
      <h1 class="text-base font-semibold uppercase tracking-wide text-project">Export applications</h1>
      <label class="block text-sm">
        Status
        <select v-model="form.status" class="form-input mt-1">
          <option value="">All</option>
          <option value="2">Pending</option>
          <option value="0">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="text-sm">
          Application Date from<DateField v-model="form.from_date" placeholder="From" />
        </div>
        <div class="text-sm">to<DateField v-model="form.to_date" placeholder="To" /></div>
      </div>
      <label class="block text-sm">
        Branch
        <select v-model="form.branch" class="form-input mt-1">
          <option value="">All</option>
          <option v-for="b in ref_.branches" :key="b.id" :value="b.code ?? ''">{{ b.value }}</option>
        </select>
      </label>
      <button type="submit" class="btn-primary-1" :disabled="busy">Download</button>
    </form>
  </section>
</template>
