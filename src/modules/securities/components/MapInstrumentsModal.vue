<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { problemOf } from '@/api/http'
import { failureMessage } from '@/modules/application/submit'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { collateralsApi } from '../api'

/** "Mass Instruments Of Claim Map" (#mapInstrumentsOfClaimModal): every collateral whose instrument matches `change_from` gets `change_to`. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ mapped: [updated: number] }>()

const ref_ = useReferenceStore()
onMounted(() => ref_.load('instruments-of-claim'))

const from = ref('')
const to = ref('')
const busy = ref(false)
const errors = ref<Record<string, string[]>>({})

async function submit() {
  busy.value = true
  showLoader('processing...')
  try {
    const { message, updated } = await collateralsApi.mapInstruments(from.value, to.value)
    hideLoader()
    open.value = false
    if (updated > 0) toast.success(message)
    else toast.error(message)
    from.value = ''
    to.value = ''
    errors.value = {}
    emit('mapped', updated)
  } catch (e) {
    errors.value = problemOf(e)?.errors ?? {}
    open.value = false
    await swalNotification('error', failureMessage(e))
    open.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-24 z-50 w-[min(34rem,94vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <DialogTitle class="mb-4 text-base font-semibold uppercase tracking-wide text-project"
          >Mass Instruments Of Claim Map</DialogTitle
        >
        <form class="space-y-3" @submit.prevent="submit">
          <div class="flex items-center gap-4">
            <label for="map-from" class="w-1/4 text-right text-sm">Change</label>
            <input
              id="map-from"
              v-model="from"
              type="text"
              autocomplete="off"
              class="form-input flex-1"
              :class="{ 'is-invalid': errors.change_from }"
              required
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="map-to" class="w-1/4 text-right text-sm">To</label>
            <select
              id="map-to"
              v-model="to"
              class="form-input flex-1"
              :class="{ 'is-invalid': errors.change_to }"
              required
            >
              <option value="">--Select--</option>
              <option v-for="i in ref_.items('instruments-of-claim')" :key="i.code" :value="i.value">
                {{ i.value }} ({{ i.code }})
              </option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <DialogClose class="btn-outline" type="button">Cancel</DialogClose>
            <button
              type="submit"
              class="rounded bg-success px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              :disabled="busy"
            >
              Apply Changes
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
