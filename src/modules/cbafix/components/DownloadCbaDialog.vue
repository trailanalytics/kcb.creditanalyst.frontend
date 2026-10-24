<script setup lang="ts">
import { ref, watch } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import DateField from '@/components/ui/DateField.vue'
import { previousMonthEnd } from '@/modules/analysis/analysisModel'

/** The report date and DSM version of "Download Short CBA": the file is written from the table as it is now. */
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ confirm: [toDate: string, version: '7.0' | '8.0'] }>()

const toDate = ref<string | null>(previousMonthEnd())
const version = ref<'7.0' | '8.0'>('8.0')
const missing = ref(false)

watch(open, (v) => {
  if (v) {
    toDate.value = previousMonthEnd()
    version.value = '8.0'
    missing.value = false
  }
})

function submit() {
  if (!toDate.value) {
    missing.value = true
    return
  }
  emit('confirm', toDate.value, version.value)
}
</script>

<template>
  <DialogRoot v-model:open="open" :modal="false">
    <DialogPortal>
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40" aria-hidden="true" @click="open = false"></div>
      <DialogContent
        class="fixed left-1/2 top-24 z-50 w-[min(28rem,95vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-3 text-base font-semibold text-project">Download Short CBA</DialogTitle>
        <p class="mb-4 text-sm text-slate-600">
          Writes the CBA file from the table as it is now, without generating it again. Follow it on the
          Background Processes page.
        </p>
        <div class="mb-3">
          <label class="mb-1 block text-sm font-medium">Report date</label>
          <DateField v-model="toDate" />
          <p v-if="missing" class="mt-1 text-xs text-danger">Select the report date.</p>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium" for="cba-version">DSM version</label>
          <select id="cba-version" v-model="version" class="form-input">
            <option value="8.0">8.0</option>
            <option value="7.0">7.0</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-outline" @click="open = false">Cancel</button>
          <button
            type="button"
            class="btn-primary-1"
            :disabled="props.busy"
            data-testid="download-confirm"
            @click="submit"
          >
            Download
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
