<script setup lang="ts">
import type { Customer } from '@/modules/customer/types'

/** The name, client number, FCS number and identity numbers of a guarantor, stakeholder or borrower in the CCG and BS lists. */
defineProps<{ profile: Customer | null; strong?: boolean }>()
const text = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v))
</script>

<template>
  <div v-if="profile" class="text-sm" :class="strong ? 'text-ink' : 'text-slate-500'">
    <div class="font-semibold" :class="strong ? 'text-project' : ''">{{ profile.full_name.trim() }}</div>
    <div>Client Number: {{ profile.clientNumber }}</div>
    <div>FCS No: {{ text(profile.II_FCSNumber) }}</div>
    <template v-if="profile.classificationCode !== '1'">
      <div>NIN: {{ text(profile.individual_details?.II_CountryID) }}</div>
    </template>
    <template v-else>
      <div>Reg No: {{ text(profile.non_individual_details?.II_RegistrationCertificateNumber) }}</div>
      <div>TIN : {{ text(profile.non_individual_details?.II_TaxIdentificationNumber) }}</div>
    </template>
  </div>
  <div v-else class="text-sm text-muted">—</div>
</template>
