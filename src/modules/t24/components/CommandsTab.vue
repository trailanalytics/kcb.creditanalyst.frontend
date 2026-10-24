<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { t24Api } from '../api'
import { failureMessage } from '../logic'
import type { T24Command } from '../types'

/** "T24 Commands": starts an extract or merge in the background. The server answers 202 once it has queued the run. */
const commands = ref<T24Command[]>([])
const selected = ref('')
const running = ref(false)
const hint = ref('')
const loadError = ref('')

onMounted(async () => {
  try {
    commands.value = await t24Api.commands()
  } catch (e) {
    loadError.value = messageOf(e, 'The commands could not be loaded.')
  }
})

async function run() {
  hint.value = ''
  if (!selected.value) {
    hint.value = 'Select a command to run.'
    return
  }
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'Are you sure you want to run this command?',
    showCancelButton: true,
    confirmButtonText: 'Yes, run command.',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  running.value = true
  showLoader('starting command, please wait...')
  try {
    const result = await t24Api.runCommand(selected.value)
    hideLoader()
    // 200 and 202 both mean the command was accepted
    await swalNotification('success', result.message)
  } catch (e) {
    hideLoader()
    const message = failureMessage(e, 'Error processing your request!')
    if (message) await swalNotification('error', message)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="border-b border-slate-200 px-4 py-2 text-sm font-medium">T24 Commands and Configuration</div>
    <div class="p-4">
      <div class="card max-w-md">
        <div class="space-y-3 p-4">
          <p class="text-sm font-semibold text-muted">
            This service will help you fetch records that are available in T24 but not in Credit Analyst
          </p>
          <select v-model="selected" class="form-input" aria-label="Command">
            <option value="">--- select command ---</option>
            <option v-for="c in commands" :key="c.name" :value="c.name">
              {{ c.name }} ({{ c.description }})
            </option>
          </select>
          <p v-if="loadError" class="text-sm text-danger" role="alert">{{ loadError }}</p>
          <p v-if="hint" class="text-sm text-danger" role="alert">{{ hint }}</p>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="rounded bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-60"
              :disabled="running"
              @click="run"
            >
              Run Command
            </button>
            <span class="text-sm text-muted" data-testid="command-status">
              Status:
              <template v-if="running">
                <svg class="inline h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" />
                </svg>
                running...
              </template>
              <template v-else>Inactive</template>
            </span>
          </div>
        </div>
        <div class="border-t border-slate-200 px-4 py-2 text-xs text-muted">
          Run the merge commands after extraction.
        </div>
      </div>
    </div>
  </div>
</template>
