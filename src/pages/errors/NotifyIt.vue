<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { http } from '@/api/http'

/** "Notify IT" on the 500 page: sends the reference and an optional note to POST /api/v1/error-report. */
const props = defineProps<{ reference: string }>()

const open = ref(false)
const message = ref('')
const busy = ref(false)
const result = ref<{ ok: boolean; text: string } | null>(null)

async function send() {
  busy.value = true
  result.value = null
  try {
    const { data } = await http.post<{ message: string }>(
      '/error-report',
      { reference: props.reference, message: message.value || null },
      { headers: { 'x-handled': '1' } },
    )
    result.value = { ok: true, text: data.message }
  } catch (e) {
    const text = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.response?.data?.detail) : null
    result.value = {
      ok: false,
      text: text ?? 'We could not send the report. Please call IT support on 42154 and quote the reference.',
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mt-5 text-left">
    <button
      v-if="!open"
      type="button"
      class="mx-auto block rounded bg-project px-4 py-2 text-sm font-medium text-white"
      @click="open = true"
    >
      Notify IT
    </button>
    <form v-else-if="!result?.ok" class="space-y-3" @submit.prevent="send">
      <label class="block text-sm text-slate-600">
        What were you doing? (optional)
        <textarea
          v-model="message"
          rows="3"
          maxlength="2000"
          class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        ></textarea>
      </label>
      <p v-if="result" class="text-sm font-semibold text-danger" role="alert">{{ result.text }}</p>
      <div class="flex justify-center gap-3">
        <button
          type="submit"
          :disabled="busy"
          class="rounded bg-project px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {{ busy ? 'Sending…' : 'Send to IT' }}
        </button>
        <button type="button" class="rounded border border-slate-300 px-4 py-2 text-sm" @click="open = false">
          Cancel
        </button>
      </div>
    </form>
    <p v-else class="text-center text-sm font-semibold text-success" role="status">{{ result.text }}</p>
    <p class="mt-4 text-center text-xs text-slate-400">
      Or call IT support on 42154 and quote this reference.
    </p>
  </div>
</template>
