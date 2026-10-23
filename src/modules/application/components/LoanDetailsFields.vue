<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useReferenceStore } from '@/stores/reference'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import ProfileRow from '@/modules/customer/components/ProfileRow.vue'
import type { LoanModel } from '../types'

/** The "Loan Details" section of the CAP forms (cap/create.blade.php, cap/joint.blade.php). */
const props = defineProps<{ editing?: boolean; invalid?: string[]; idPrefix: string }>()
const model = defineModel<LoanModel>({ required: true })
const ref = useReferenceStore()
onMounted(() => ref.load('branches', 'currencies', 'loan-product-types', 'loan-purposes'))

const currencies = computed(() => ref.items('currencies'))
const bad = (name: string) => props.invalid?.includes(name)
const id = (name: string) => `${props.idPrefix}-${name}`
</script>

<template>
  <section>
    <h3 class="mb-1 text-lg text-muted">Loan Details</h3>
    <hr class="mb-4" />
    <ProfileRow label="Application Date" :for-id="id('date')">
      <input :id="id('date')" v-model="model.creditApplicationDate" type="date" class="form-input flex-1" />
    </ProfileRow>
    <ProfileRow v-if="editing" label="CAP Reference">
      <input :value="model.creditApplicationReference" class="form-input flex-1" readonly />
    </ProfileRow>
    <ProfileRow label="Amount" :for-id="id('amount')">
      <select v-model="model.currency" class="form-input w-1/3" aria-label="Currency">
        <option value="UGX">UGX</option>
        <option v-for="c in currencies.filter((c) => c.code !== 'UGX')" :key="c.code" :value="c.code">
          {{ c.code }}
        </option>
      </select>
      <div class="flex-1"><MoneyInput v-model="model.amount" name="amount" /></div>
    </ProfileRow>
    <ProfileRow label="Loan Type" :for-id="id('type')">
      <select
        :id="id('type')"
        v-model="model.CreditAccountLoanProductType"
        class="form-input flex-1"
        :class="{ 'is-invalid': bad('CreditAccountLoanProductType') }"
      >
        <option value="">Select Type</option>
        <option v-for="t in ref.items('loan-product-types')" :key="t.code" :value="t.code">
          {{ t.value }}
        </option>
      </select>
    </ProfileRow>
    <ProfileRow label="Term" :for-id="id('term')">
      <input :id="id('term')" v-model="model.Term" type="text" inputmode="numeric" class="form-input w-1/3" />
      <select
        v-model="model.Term_Period"
        class="form-input flex-1"
        :class="{ 'is-invalid': bad('Term_Period') }"
        aria-label="Term period"
      >
        <option value="">Select</option>
        <option value="Month">Month(s)</option>
        <option value="Year">Year(s)</option>
      </select>
    </ProfileRow>
    <ProfileRow label="Loan Purpose" :for-id="id('purpose')">
      <select
        :id="id('purpose')"
        v-model="model.loanPurpose"
        class="form-input flex-1"
        :class="{ 'is-invalid': bad('loanPurpose') }"
      >
        <option value="">Select</option>
        <option v-for="p in ref.items('loan-purposes')" :key="p.code" :value="p.code">{{ p.value }}</option>
      </select>
    </ProfileRow>
    <ProfileRow label="Branch" :for-id="id('branch')">
      <select
        :id="id('branch')"
        v-model="model.branch"
        class="form-input flex-1"
        :class="{ 'is-invalid': bad('branch') }"
      >
        <option value="">Select</option>
        <option v-for="b in ref.branches" :key="b.id" :value="b.code ?? ''">{{ b.value }}</option>
      </select>
    </ProfileRow>
  </section>
</template>
