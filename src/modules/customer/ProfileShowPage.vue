<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { swalNotification } from '@/utils/dialogs'
import { profilesApi } from './api'
import CustomerHeader from './components/CustomerHeader.vue'
import type { Customer } from './types'

/** /borrowers/{id}: the profile header with the New CAP and Edit Profile actions (borrowers/show.blade.php). */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const router = useRouter()
const customer = ref<Customer | null>(null)

onMounted(async () => {
  try {
    customer.value = await profilesApi.get(props.id)
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The profile could not be loaded.'))
    await router.replace('/profiles')
  }
})
</script>

<template>
  <section v-if="customer" class="card flex flex-wrap items-start justify-between gap-4 p-6">
    <CustomerHeader :customer="customer" />
    <div class="flex gap-2">
      <RouterLink
        v-if="auth.has('Create Applications')"
        :to="`/applications/create/${customer.clientNumber}`"
        class="btn-primary-1"
        >+ New Cap</RouterLink
      >
      <RouterLink
        v-if="auth.has('Update Profiles')"
        :to="`/borrowers/edit/${customer.id}`"
        class="btn-outline"
        >Edit Profile</RouterLink
      >
    </div>
  </section>
</template>
