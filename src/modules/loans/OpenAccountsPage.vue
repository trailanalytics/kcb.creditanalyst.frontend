<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import DropFile from '@/components/ui/DropFile.vue'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import { blobFailure, filenameOf, saveBlob } from './download'

/** /open-accounts: upload a list of contract codes, download the workbook of those loans (cba/open_accounts.blade.php). */
const file = ref<File | null>(null)
const busy = ref(false)

async function generate() {
  if (!file.value) return void swalNotification('error', 'Please choose the open accounts template first.')
  busy.value = true
  showLoader('generating the report...')
  try {
    const response = await loansApi.openAccounts(file.value)
    saveBlob(response.data, filenameOf(response.headers, 'open accounts export.xlsx'))
    hideLoader()
  } catch (e) {
    hideLoader()
    await swalNotification('error', await blobFailure(e, 'The report could not be generated.'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Open Accounts
    </nav>
    <form class="card px-8 py-10" @submit.prevent="generate">
      <div class="grid items-end gap-6 md:grid-cols-2">
        <DropFile
          accept=".xlsx, .xls, .csv"
          label="Drag & Drop the open accounts template or browse"
          @file="file = $event"
        />
        <button type="submit" class="btn-system w-full py-3" :disabled="busy">GENERATE REPORT</button>
      </div>
      <hr class="mt-10" />
      <a
        href="/templates/OPEN_ACCOUNTS_TEMPLATE.xlsx"
        class="mt-3 inline-block text-sm text-slate-500"
        download
        >⬇ Download Template</a
      >
    </form>
  </section>
</template>
