<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

/** The "View" modal of the Requests page: the column names of the record as headers and its values in one row. */
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ record: Record<string, unknown> | null }>()

const columns = computed(() => Object.keys(props.record ?? {}))
const show = (value: unknown) => (value === null || value === undefined ? '' : String(value))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-20 z-50 w-[min(72rem,94vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        data-testid="record-modal"
      >
        <DialogTitle class="mb-1 text-base font-semibold text-project">Record Details</DialogTitle>
        <DialogDescription class="sr-only"
          >The stored values of the record this request is about.</DialogDescription
        >
        <div class="mt-3 max-h-[60vh] overflow-auto">
          <table class="w-full text-left text-sm" data-testid="record-table">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th v-for="c in columns" :key="c" class="whitespace-nowrap px-3 py-2 font-medium">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-t border-slate-100">
                <td v-for="c in columns" :key="c" class="px-3 py-2 align-top break-words">
                  {{ show(record?.[c]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded bg-danger px-4 py-2 text-sm font-medium text-white"
            @click="open = false"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
