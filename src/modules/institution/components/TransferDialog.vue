<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { institutionApi } from '../api'
import { showFailure } from '../failure'

/**
 * "Transfer Customers from one Branch to another." (the modal on /branches). Moves every customer and loan account of the From
 * branch to the To branch. Options are every branch, not only the pages of the list already scrolled in.
 */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const reference = useReferenceStore()
const from = ref('')
const to = ref('')
const fromError = ref(false)
const toError = ref(false)
const branches = computed(() => reference.branches.filter((b) => b.code))

watch(open, (isOpen) => {
  if (!isOpen) return
  void reference.load('branches')
  from.value = ''
  to.value = ''
  fromError.value = false
  toError.value = false
})

async function begin() {
  fromError.value = !from.value
  toError.value = !to.value
  if (fromError.value || toError.value) return

  // the dialog traps focus, so it steps aside while the confirmation is up
  open.value = false
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'You are about to transfer customers from one branch to another! Proceed?',
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed!',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) {
    open.value = true
    return
  }
  showLoader('transferring...')
  try {
    const result = await institutionApi.transfer(from.value, to.value)
    hideLoader()
    await swalNotification('success', result.message)
    emit('done')
  } catch (e) {
    await showFailure(e)
    open.value = true
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-24 z-50 w-[min(52rem,94vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <DialogTitle class="mb-4 text-base font-semibold text-project">
          Transfer Customers from one Branch to another.
        </DialogTitle>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="flex">
              <span class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                >From</span
              >
              <select v-model="from" class="form-input rounded-l-none" aria-label="From branch">
                <option value="">--- select ---</option>
                <option v-for="b in branches" :key="b.id" :value="b.code ?? ''">{{ b.value }}</option>
              </select>
            </label>
            <p v-if="fromError" class="mt-1 text-xs text-danger">This field is required</p>
          </div>
          <div>
            <label class="flex">
              <span class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                >To</span
              >
              <select v-model="to" class="form-input rounded-l-none" aria-label="To branch">
                <option value="">--- select ---</option>
                <option v-for="b in branches" :key="b.id" :value="b.code ?? ''">{{ b.value }}</option>
              </select>
            </label>
            <p v-if="toError" class="mt-1 text-xs text-danger">This field is required</p>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn-primary-1 !bg-danger" @click="open = false">Cancel</button>
          <button type="button" class="btn-primary-1 !bg-kcb-green" @click="begin">Begin Transfer</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
