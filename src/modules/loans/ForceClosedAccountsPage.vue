<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { swalNotification } from '@/utils/dialogs'
import ForceCloseDialog from './components/ForceCloseDialog.vue'
import ForceCloseUploadDialog from './components/ForceCloseUploadDialog.vue'
import LoanList from './components/LoanList.vue'
import { escapeHtml } from './loanModel'
import type { ForceCloseImportResult } from './types'

/** /force-closed-accounts: loans that were force closed, with the manual form and the template upload (cba/force_closed_accounts.blade.php). */
const auth = useAuthStore()
const list = ref<InstanceType<typeof LoanList> | null>(null)
const manualOpen = ref(false)
const uploadOpen = ref(false)

async function imported(result: ForceCloseImportResult) {
  let html = escapeHtml(result.message)
  if (result.not_found.length)
    html += `<br/><br/>Not found: ${escapeHtml(result.not_found.join(', '))}${result.not_found_count > result.not_found.length ? ' ...' : ''}`
  if (result.skipped.length) html += `<br/><br/>Skipped:<br/>${result.skipped.map(escapeHtml).join('<br/>')}`
  await swalNotification('success', html)
  await list.value?.reload()
}
</script>

<template>
  <LoanList ref="list" url="/force-closed-accounts" name-class="text-success">
    <template #breadcrumb>
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CBA / Force Close Loan Accounts
    </template>
    <template #toolbar>
      <template v-if="auth.has('Update CBA Details')">
        <button type="button" class="btn-primary-1" @click="manualOpen = true">+ Force Close Accounts</button>
        <button type="button" class="btn-primary-1" @click="uploadOpen = true">Upload Template</button>
      </template>
    </template>
  </LoanList>
  <ForceCloseDialog v-model:open="manualOpen" @saved="list?.reload()" />
  <ForceCloseUploadDialog v-model:open="uploadOpen" @done="imported" />
</template>
