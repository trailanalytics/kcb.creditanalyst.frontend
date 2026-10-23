<script setup lang="ts">
import { useProfileOptions } from '../options'
import ProfileRow from './ProfileRow.vue'
import ProfileInput from './ProfileInput.vue'
import ProfileDateParts from './ProfileDateParts.vue'

defineProps<{ showHeading: boolean; hideVat?: boolean }>()
const o = useProfileOptions()
</script>

<template>
  <section data-section="non-individual">
    <template v-if="showHeading">
      <h3 class="mb-1 text-lg text-muted">Company Information</h3>
      <hr class="mb-4" />
    </template>
    <ProfileRow label="Business Name"
      ><ProfileInput name="GSCAFB_BusinessName" placeholder="Business Name"
    /></ProfileRow>
    <ProfileRow label="Trading Name" star
      ><ProfileInput name="GSCAFB_TradingName" placeholder="Trading Name"
    /></ProfileRow>
    <ProfileRow label="Activity Description"><ProfileInput name="GSCAFB_ActivityDescription" /></ProfileRow>
    <ProfileRow label="Business Type"
      ><ProfileInput
        name="GSCAFB_BusinessTypeCode"
        :options="o.businessTypes.value"
        blank="--- Select Business Type ---"
    /></ProfileRow>
    <ProfileRow label="Industry"
      ><ProfileInput
        name="GSCAFB_IndustrySectorCode"
        :options="o.industries.value"
        blank="--- Select Industry ---"
    /></ProfileRow>
    <ProfileRow label="Date Of Registration">
      <ProfileDateParts
        day="GSCAFB_DayRegistered"
        month="GSCAFB_MonthRegistered"
        year="GSCAFB_YearRegistered"
        :from="1920"
      />
    </ProfileRow>

    <h3 class="mb-1 mt-8 text-lg text-muted">Identification</h3>
    <hr class="mb-4" />
    <ProfileRow label="Fcs Number"><ProfileInput name="II_FCSNumber" placeholder="FCS" /></ProfileRow>
    <ProfileRow label="TIN Number"
      ><ProfileInput name="II_TaxIdentificationNumber" placeholder="TIN"
    /></ProfileRow>
    <ProfileRow label="Registration Certificate Number"
      ><ProfileInput name="II_RegistrationCertificateNumber" placeholder="REG NO"
    /></ProfileRow>
    <ProfileRow v-if="!hideVat" label="VAT Number"
      ><ProfileInput name="II_ValueAddedTaxNumber" placeholder="VAT"
    /></ProfileRow>
    <ProfileRow label="Country Of Issue"
      ><ProfileInput name="II_CountryOfIssue" :options="o.nationalities.value" blank="--- select ---"
    /></ProfileRow>
  </section>
</template>
