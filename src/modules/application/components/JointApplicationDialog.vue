<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import SearchableSelect, { type Option } from '@/components/ui/SearchableSelect.vue'
import { swalNotification } from '@/utils/dialogs'

/** "JOINT APPLICATION CUSTOMERS" modal of the dashboard (JointApplication.vue): pick two or more customers, then go to the form. */
const open = defineModel<boolean>('open', { required: true })
const router = useRouter()
const selected = ref<Option[]>([])

async function proceed() {
  if (selected.value.length < 2)
    return void swalNotification('error', 'Select at least 2 customers to proceed!')
  const args = selected.value.map((s) => s.value).join('-')
  open.value = false
  selected.value = []
  await router.push(`/applications/joint/create/${args}`)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-24 z-50 w-[min(42rem,92vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
      >
        <DialogTitle class="mb-4 text-base font-semibold uppercase tracking-wide text-project">
          Joint Application Customers
        </DialogTitle>
        <SearchableSelect
          v-model="selected"
          options-url="/borrowers/options"
          placeholder="search customer by name"
        />
        <div class="mt-6 flex justify-end gap-2">
          <DialogClose class="btn-outline">Cancel</DialogClose>
          <button type="button" class="btn-primary-1" @click="proceed">PROCEED</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
