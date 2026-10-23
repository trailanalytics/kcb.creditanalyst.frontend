<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Customer } from '../types'

/** The name, client number, FCS and NIN / registration details shown at the top of the profile and CAP pages. */
const props = defineProps<{ customer: Customer; size?: number }>()
const individual = computed(() => props.customer.classificationCode !== '1')
const nin = computed(() => props.customer.individual_details?.II_CountryID as string | undefined)
const reg = computed(
  () => props.customer.non_individual_details?.II_RegistrationCertificateNumber as string | undefined,
)
const tin = computed(
  () => props.customer.non_individual_details?.II_TaxIdentificationNumber as string | undefined,
)
</script>

<template>
  <div class="flex items-start gap-4">
    <img src="/img/profile-placeholder.jpg" alt="" :width="size ?? 100" class="rounded" />
    <div>
      <h2 class="text-xl font-semibold text-project">
        <RouterLink :to="`/borrowers/${customer.id}`">{{
          customer.full_name.trim() || 'Unnamed customer'
        }}</RouterLink>
        <span class="ml-2 align-middle text-xs font-normal text-muted">({{ customer.customer_type }})</span>
      </h2>
      <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
        <dt class="text-muted">Client No</dt>
        <dd>{{ customer.clientNumber }}</dd>
        <dt class="text-muted">FCS No</dt>
        <dd>{{ customer.II_FCSNumber || '—' }}</dd>
        <template v-if="individual">
          <dt class="text-muted">NIN</dt>
          <dd>{{ nin || '—' }}</dd>
        </template>
        <template v-else>
          <dt class="text-muted">Reg No</dt>
          <dd>{{ reg || '—' }}</dd>
          <dt class="text-muted">TIN</dt>
          <dd>{{ tin || '—' }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>
