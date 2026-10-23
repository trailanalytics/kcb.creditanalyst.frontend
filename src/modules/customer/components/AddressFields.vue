<script setup lang="ts">
import { useProfileOptions } from '../options'
import ProfileRow from './ProfileRow.vue'
import ProfileInput from './ProfileInput.vue'
import ProfileDateParts from './ProfileDateParts.vue'

/** Address (PCI_*) or Alternative Address (SCI_*): same fields, different prefix. */
const props = defineProps<{ prefix: 'PCI_' | 'SCI_'; title: string }>()
const o = useProfileOptions()
const n = (field: string) => props.prefix + field
const ownership = [
  { value: 'O', label: 'Owner' },
  { value: 'T', label: 'Tenant' },
]
const phones = [
  { label: 'Phone (Primary)', key: 'Primary', areaPh: '78', numberPh: '6409927' },
  { label: 'Phone (Mobile)', key: 'Mobile', areaPh: '78', numberPh: '6409927' },
  { label: 'Phone (Other)', key: 'Other', areaPh: '78', numberPh: '6409927' },
] as const
const numberField = (key: string) =>
  key === 'Primary' ? 'PrimaryTelephoneNumber' : key === 'Mobile' ? 'MobileNumber' : 'OtherTelephoneNumber'
</script>

<template>
  <section :data-section="prefix">
    <h3 class="mb-1 mt-8 text-lg text-muted">{{ title }}</h3>
    <hr class="mb-4" />
    <ProfileRow label="Country"
      ><ProfileInput :name="n('CountryCode')" :options="o.nationalities.value" blank="--- select ---"
    /></ProfileRow>
    <ProfileRow label="Region"
      ><ProfileInput :name="n('Region')" :options="o.regions.value" blank="--- select ---"
    /></ProfileRow>
    <ProfileRow label="District"><ProfileInput :name="n('District')" placeholder="District" /></ProfileRow>
    <ProfileRow label="County/Town"
      ><ProfileInput :name="n('CountyorTown')" placeholder="County/Town"
    /></ProfileRow>
    <ProfileRow label="Suburb"><ProfileInput :name="n('Suburb')" placeholder="Suburb" /></ProfileRow>
    <ProfileRow label="Parish"><ProfileInput :name="n('Parish')" placeholder="Parish" /></ProfileRow>
    <ProfileRow label="Village"><ProfileInput :name="n('Village')" placeholder="Village" /></ProfileRow>
    <ProfileRow v-for="p in phones" :key="p.key" :label="p.label">
      <ProfileInput :name="n(`${p.key}CountryDiallingCode`)" :options="o.dialingCodes.value" width="w-1/4" />
      <ProfileInput :name="n(`${p.key}AreaDiallingCode`)" :placeholder="p.areaPh" width="w-1/5" />
      <ProfileInput :name="n(numberField(p.key))" :placeholder="p.numberPh" width="flex-1" />
    </ProfileRow>
    <ProfileRow label="Apartment">
      <ProfileInput :name="n('UnitNumber')" placeholder="Number" />
      <ProfileInput :name="n('UnitName')" placeholder="Name" />
      <ProfileInput :name="n('FloorNumber')" placeholder="Floor" />
    </ProfileRow>
    <ProfileRow label="Plot">
      <ProfileInput :name="n('PlotorStreetNumber')" placeholder="Plot Number" />
      <ProfileInput :name="n('LCorStreetName')" placeholder="Street Name" />
    </ProfileRow>
    <ProfileRow label="P.O.Box">
      <ProfileInput :name="n('POBoxNumber')" placeholder="Number" />
      <ProfileInput :name="n('PostOfficeTown')" placeholder="Town" />
    </ProfileRow>
    <ProfileRow label="Moved To Address">
      <ProfileDateParts
        :month="n('PeriodAtAddressMonth')"
        :year="n('PeriodAtAddressYear')"
        :from="1960"
        month-blank="--- select ---"
        year-blank="--- select ---"
      />
    </ProfileRow>
    <ProfileRow label="Ownership Status"
      ><ProfileInput :name="n('FlagofOwnership')" :options="ownership" blank="--Select--"
    /></ProfileRow>
    <ProfileRow label="Email"><ProfileInput :name="n('EmailAddress')" placeholder="Email" /></ProfileRow>
    <ProfileRow label="Fax Number"><ProfileInput :name="n('FAXNumber')" placeholder="Fax" /></ProfileRow>
    <ProfileRow label="Website"><ProfileInput :name="n('Website')" placeholder="Website" /></ProfileRow>
  </section>
</template>
