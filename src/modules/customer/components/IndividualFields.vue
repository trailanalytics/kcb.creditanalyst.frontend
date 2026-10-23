<script setup lang="ts">
import { useProfileOptions } from '../options'
import { useProfile } from '../profileContext'
import ProfileRow from './ProfileRow.vue'
import ProfileInput from './ProfileInput.vue'
import ProfileDateParts from './ProfileDateParts.vue'

defineProps<{ showHeading: boolean }>()
const o = useProfileOptions()
const ctx = useProfile()
const gender = [
  { value: '0', label: 'Male' },
  { value: '1', label: 'Female' },
]
</script>

<template>
  <section data-section="individual">
    <template v-if="showHeading">
      <h3 class="mb-1 text-lg text-muted">Bio Information</h3>
      <hr class="mb-4" />
    </template>
    <ProfileRow label="First Name"
      ><ProfileInput name="GSCAFB_Forename1" placeholder="Firstname"
    /></ProfileRow>
    <ProfileRow label="SurName"><ProfileInput name="GSCAFB_Surname" placeholder="Surname" /></ProfileRow>
    <ProfileRow label="Other Name"
      ><ProfileInput name="GSCAFB_Forename2" placeholder="Other name"
    /></ProfileRow>
    <ProfileRow label="Other Name 2"
      ><ProfileInput name="GSCAFB_Forename3" placeholder="Other name"
    /></ProfileRow>
    <ProfileRow label="Gender">
      <label v-for="g in gender" :key="g.value" class="mr-4 inline-flex items-center gap-1 pt-2 text-sm">
        <input
          type="radio"
          name="GSCAFB_Gender"
          :checked="ctx.form.GSCAFB_Gender === g.value"
          :value="g.value"
          @change="ctx.set('GSCAFB_Gender', g.value)"
        />
        {{ g.label }}
      </label>
    </ProfileRow>
    <ProfileRow label="Marital Status"
      ><ProfileInput name="GSCAFB_MaritalStatus" :options="o.maritalStatuses.value" blank="--- select ---"
    /></ProfileRow>
    <ProfileRow label="Date Of Birth">
      <ProfileDateParts
        day="GSCAFB_DayOfBirth"
        month="GSCAFB_MonthOfBirth"
        year="GSCAFB_YearOfBirth"
        :from="1920"
      />
    </ProfileRow>
    <ProfileRow label="Nationality"
      ><ProfileInput name="II_Nationality" :options="o.nationalities.value" blank="--- select ---"
    /></ProfileRow>

    <h3 class="mb-1 mt-8 text-lg text-muted">Identification</h3>
    <hr class="mb-4" />
    <ProfileRow label="Fcs Number"><ProfileInput name="II_FCSNumber" placeholder="FCS" /></ProfileRow>
    <ProfileRow label="TIN Number"
      ><ProfileInput name="II_TaxIdentificationNumber" placeholder="TIN"
    /></ProfileRow>
    <ProfileRow label="Country ID">
      <ProfileInput name="II_CountryID" placeholder="NIN" width="w-1/2" />
      <ProfileInput
        name="II_CountryOfIssue"
        :options="o.nationalities.value"
        blank="--- select ---"
        width="w-1/2"
      />
    </ProfileRow>
    <ProfileRow label="Work Permit Number"><ProfileInput name="II_WorkPermitNumber" /></ProfileRow>
    <ProfileRow label="Refugee Number"><ProfileInput name="II_RefugeeNumber" /></ProfileRow>
    <ProfileRow label="Passport Number"
      ><ProfileInput name="II_PassportNumber" placeholder="Passport"
    /></ProfileRow>
    <ProfileRow label="Driver's License ID Number"
      ><ProfileInput name="II_DriversLicenceIDNumber" placeholder="Driver's Licence"
    /></ProfileRow>
    <ProfileRow label="Driver's License Permit Number"
      ><ProfileInput name="II_DriversLicensePermitNumber" placeholder="Driver's Permit No"
    /></ProfileRow>

    <h3 class="mb-1 mt-8 text-lg text-muted">Employment</h3>
    <hr class="mb-4" />
    <ProfileRow label="Employment Type"
      ><ProfileInput name="EI_EmploymentType" :options="o.employmentTypes.value" blank="--Select--"
    /></ProfileRow>
    <ProfileRow label="Primary Occupation"><ProfileInput name="EI_PrimaryOccupation" /></ProfileRow>
    <ProfileRow label="Employer Name"><ProfileInput name="EI_EmployerName" /></ProfileRow>
    <ProfileRow label="Joined Employer">
      <ProfileDateParts month="joinedEmployerMonth" year="joinedEmployerYear" :from="1960" />
    </ProfileRow>
    <ProfileRow label="Income Band"
      ><ProfileInput name="EI_IncomeBand" :options="o.incomeBands.value" blank="--Select--"
    /></ProfileRow>
    <ProfileRow label="Salary Frequency"
      ><ProfileInput name="EI_SalaryFrequency" :options="o.salaryFrequencies.value" blank="--Select--"
    /></ProfileRow>
    <ProfileRow label="Employee Number"
      ><ProfileInput name="EI_EmployeeNumber" placeholder="Employer Number"
    /></ProfileRow>
  </section>
</template>
