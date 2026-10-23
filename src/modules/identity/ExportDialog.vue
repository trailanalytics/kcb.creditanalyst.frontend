<script setup lang="ts">
import { reactive, ref } from 'vue'
import dayjs from 'dayjs'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { messageOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'
import { logsApi } from './api'

/** Export modal of the statistics page (ExportModel.vue): log type, date range and format, downloaded as a file. */
const open = ref(false)
const busy = ref(false)
const form = reactive({
  logType: 'login-logs',
  from: dayjs().startOf('month').format('YYYY-MM-DD'),
  to: dayjs().format('YYYY-MM-DD'),
  format: 'csv',
})

function fileNameOf(disposition: string | undefined, fallback: string) {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match?.[1] ? decodeURIComponent(match[1]) : fallback
}

async function download() {
  busy.value = true
  try {
    const res = await logsApi.export(form.logType, form.from, form.to, form.format)
    const name = fileNameOf(
      res.headers['content-disposition'] as string | undefined,
      `${form.logType}.${form.format}`,
    )
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    open.value = false
  } catch (e) {
    await swalNotification('error', messageOf(e, 'Error downloading file'))
  } finally {
    busy.value = false
  }
}

const field = 'w-full rounded border border-slate-300 px-3 py-2 text-sm'
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger class="rounded border border-project px-4 py-2 text-sm font-medium text-project"
      >Export</DialogTrigger
    >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[28rem] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded bg-white p-6 shadow-xl"
      >
        <DialogTitle class="text-lg font-semibold text-project">Export logs</DialogTitle>
        <DialogDescription class="mb-4 text-sm text-slate-500"
          >Choose what to export and for which dates.</DialogDescription
        >
        <div class="space-y-3">
          <label class="block text-sm"
            >Export
            <select v-model="form.logType" :class="field">
              <option value="login-logs">Login logs</option>
              <option value="activity-logs">Activity logs</option>
              <option value="deleted-records">Deleted records</option>
              <option value="users">Users</option>
            </select>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">From <input v-model="form.from" type="date" :class="field" /></label>
            <label class="block text-sm">To <input v-model="form.to" type="date" :class="field" /></label>
          </div>
          <label class="block text-sm"
            >Format
            <select v-model="form.format" :class="field">
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (xlsx)</option>
            </select>
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <DialogClose class="rounded border border-slate-300 px-4 py-2 text-sm">Cancel</DialogClose>
          <button
            type="button"
            :disabled="busy"
            class="rounded bg-project px-4 py-2 text-sm text-white disabled:opacity-60"
            @click="download"
          >
            {{ busy ? 'Preparing…' : 'Download' }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
