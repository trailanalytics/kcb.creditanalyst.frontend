<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DropFile from '@/components/ui/DropFile.vue'
import { useAuthStore } from '@/stores/auth'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { showFailure } from '@/modules/institution/failure'
import { chequeApi } from './api'
import { uploadMessage } from './uploadMessage'

/**
 * /upload-bounced-cheques and /upload-fully-paid-or-write-offs: one page for both uploads (bc/upload.blade.php). The fully paid
 * variant is chosen by the path or, as in Laravel, by `?cba=1`.
 */
const props = withDefaults(defineProps<{ fullyPaid?: boolean }>(), { fullyPaid: false })
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const fullyPaidMode = computed(() => props.fullyPaid || Boolean(route.query.cba))
const caption = computed(() =>
  fullyPaidMode.value ? 'fully paid / written off template' : 'bounced cheques template',
)
const file = ref<File | null>(null)
// bumped after a successful upload so the drop box forgets the file name
const dropKey = ref(0)
const busy = ref(false)

async function upload() {
  if (!file.value) {
    return void swalNotification(
      'error',
      fullyPaidMode.value
        ? 'No file uploaded. Please upload a Fully Paid Template!'
        : 'No file uploaded. Please upload a Bounced Cheques Template!',
    )
  }
  busy.value = true
  showLoader('uploading, please wait...')
  try {
    const result = fullyPaidMode.value
      ? await chequeApi.uploadFullyPaid(file.value)
      : await chequeApi.uploadCheques(file.value)
    hideLoader()
    file.value = null
    dropKey.value += 1
    // the cheque list shows what was just uploaded; the closed-account upload has nothing to show there
    if (!fullyPaidMode.value && auth.has('View Bounced Cheques')) await router.push('/bc-list')
    await swalNotification(
      result.not_found.length ? 'warning' : 'success',
      uploadMessage(result, fullyPaidMode.value),
    )
  } catch (e) {
    await showFailure(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-4xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/bc-list" class="text-primary-1">{{ fullyPaidMode ? 'CBA' : 'BC' }}</RouterLink> /
      Upload
    </nav>
    <form class="card px-6 py-10" novalidate @submit.prevent="upload">
      <div class="grid items-start gap-6 md:grid-cols-[1fr_1fr]">
        <DropFile
          :key="dropKey"
          accept=".xlsx, .xls, .csv"
          :label="`Drag & Drop ${caption} or browse`"
          @file="file = $event"
        />
        <button type="submit" class="btn-system w-full" :disabled="busy">Upload</button>
      </div>
      <template v-if="!fullyPaidMode">
        <hr class="my-8" />
        <a href="/templates/BOUNCED_CHEQUES_TEMPLATE.xlsx" download class="text-sm text-slate-500"
          >⬇ Download Template</a
        >
      </template>
    </form>
  </section>
</template>
