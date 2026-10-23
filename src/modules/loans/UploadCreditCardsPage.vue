<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { RouterLink } from 'vue-router'
import { messageOf, problemOf } from '@/api/http'
import DropFile from '@/components/ui/DropFile.vue'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import { creditCardSummary, errorLines } from './loanModel'

/** /upload-credit-cards: one loan account per row of the credit card template (cba/upload_template.blade.php). */
const file = ref<File | null>(null)
const busy = ref(false)

async function upload() {
  if (!file.value)
    return void swalNotification('error', 'No file uploaded. Please upload a Credit Cards Template!')
  busy.value = true
  showLoader('uploading...')
  try {
    const result = await loansApi.creditCards(file.value)
    hideLoader()
    await swalNotification(
      result.not_found.length || result.skipped.length ? 'warning' : 'success',
      creditCardSummary(result),
    )
  } catch (e) {
    hideLoader()
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
      await swalNotification('error', errorLines(problem.errors).join('<br>'))
    else await swalNotification('error', messageOf(e, 'The credit cards could not be uploaded.'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CBA / Upload
    </nav>
    <form class="card px-8 py-10" @submit.prevent="upload">
      <div class="grid items-end gap-6 md:grid-cols-2">
        <DropFile
          accept=".xlsx, .xls, .csv"
          label="Drag & Drop the credit cards template or browse"
          @file="file = $event"
        />
        <button type="submit" class="btn-system w-full py-3" :disabled="busy">UPLOAD</button>
      </div>
      <hr class="mt-10" />
      <a href="/templates/CREDIT_CARD_TEMPLATE.xls" class="mt-3 inline-block text-sm text-slate-500" download
        >⬇ Download Template</a
      >
    </form>
  </section>
</template>
