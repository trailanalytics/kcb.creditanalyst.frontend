<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { useReferenceStore } from '@/stores/reference'
import { useAuthStore } from '@/stores/auth'
import { swalNotification } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import { applicationsApi } from './api'
import { crbToLong, termText } from './loanModel'
import type { Application } from './types'

/** /applications/show/{id}: header with the key facts and the collapsible "Full Loan Details" (cap/show.blade.php). */
const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const ref_ = useReferenceStore()
const app = ref<Application | null>(null)
const showAll = ref(false)

onMounted(async () => {
  try {
    const [a] = await Promise.all([
      applicationsApi.get(props.id),
      ref_.load(
        'loan-product-types',
        'loan-purposes',
        'branches',
        'application-statuses',
        'rejection-reasons',
      ),
    ])
    app.value = a
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The application could not be loaded.'))
    await router.replace('/applications')
  }
})

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
/** "Value (code)" for appendix values, as in the full details. */
const withCode = (name: string, code: string | null | undefined) =>
  code ? `${ref_.label(name, code)} (${code})` : '—'
const money = (currency: string | null, v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : `${currency ?? ''} ${formatNumber(v as string)}`.trim()

const groups = computed(() => {
  const a = app.value
  if (!a) return []
  const out: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Application',
      rows: [
        ['CAP Reference', dash(a.creditApplicationReference)],
        ['Client Number', dash(a.clientNumber)],
        ['Branch', dash(ref_.branchName(a.branchCode))],
        ['Application Date', dash(crbToLong(a.creditApplicationDate))],
        ['Loan Product Type', withCode('loan-product-types', a.creditAccountLoanProductType)],
        ['Loan Purpose', withCode('loan-purposes', a.loanPurpose)],
        ['Joint Account Number', dash(a.jointAccountNumber)],
      ],
    },
    {
      title: 'Amount & Term',
      rows: [
        ['Amount Applied For', money(null, a.Amount)],
        ['Currency', dash(a.currency)],
        ['Term', dash(termText(a.Term, a.TermPeriod))],
        ['Term (days)', dash(a.termInDays)],
      ],
    },
    {
      title: 'Status',
      rows: [
        ['Status', withCode('application-statuses', a.creditApplicationStatus)],
        ['Last Status Change Date', dash(crbToLong(a.lastStatusChangeDate))],
        ['Application Duration (days)', dash(a.creditApplicationDuration)],
        ['Amount Approved', money(null, a.creditAmountApproved)],
        ['Approved Loan Account', dash(a.approval?.contractCode)],
        ['Approved On', dash(a.approval?.approvedOn)],
        ['Approved By', dash(a.approval?.createdby)],
        ['Rejection Reason', withCode('rejection-reasons', a.rejection?.rejectionReason)],
        ['Rejected On', dash(a.rejection?.rejectedOn)],
        ['Rejected By', dash(a.rejection?.createdby)],
      ],
    },
  ]
  if (a.restructured)
    out.push({
      title: 'Restructuring',
      rows: [
        ['Previous Loan Account', dash(a.restructured.contractCode)],
        ['Restructured Date', dash(a.restructured.restructuredDate)],
        ['Restructured Amount', money(null, a.restructured.restructuredAmount)],
      ],
    })
  out.push({
    title: 'Record',
    rows: [
      ['Created By', dash(a.createdby)],
      ['Created At', dash(a.created_at)],
      ['Last Updated', dash(a.updated_at)],
    ],
  })
  return out
})
</script>

<template>
  <section v-if="app" class="mx-auto max-w-6xl">
    <div class="card mb-6 p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-project">
            <RouterLink v-if="app.customer" :to="`/borrowers/${app.customer.id}`">{{
              app.customer.full_name.trim() || 'Unnamed customer'
            }}</RouterLink>
            <template v-else>Unnamed customer</template>
            <span
              v-if="app.customer"
              class="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600"
              >{{ app.customer.customer_type }}</span
            >
          </h1>
          <dl v-if="app.customer" class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
            <dt class="text-muted">Client No</dt>
            <dd>{{ app.customer.clientNumber }}</dd>
            <dt class="text-muted">FCS No</dt>
            <dd>{{ dash(app.customer.II_FCSNumber) }}</dd>
            <template v-if="app.customer.classificationCode !== '1'">
              <dt class="text-muted">NIN</dt>
              <dd>{{ dash(app.customer.individual_details?.II_CountryID) }}</dd>
            </template>
            <template v-else>
              <dt class="text-muted">Reg No</dt>
              <dd>{{ dash(app.customer.non_individual_details?.II_RegistrationCertificateNumber) }}</dd>
              <dt class="text-muted">TIN</dt>
              <dd>{{ dash(app.customer.non_individual_details?.II_TaxIdentificationNumber) }}</dd>
            </template>
          </dl>
        </div>
        <div class="flex gap-2">
          <RouterLink
            v-if="auth.has('Approve/Reject Applications')"
            :to="`/applications/change-status/${app.id}`"
            class="btn-primary-1"
            >Change Status</RouterLink
          >
          <RouterLink
            v-if="auth.has('Edit Applications') && app.creditApplicationStatus === '2'"
            :to="`/applications/edit/${app.id}`"
            class="btn-outline"
            >Edit</RouterLink
          >
        </div>
      </div>
      <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt class="text-muted">Amount</dt>
          <dd class="font-medium">{{ money(app.currency, app.Amount) }}</dd>
        </div>
        <div>
          <dt class="text-muted">CAP Reference</dt>
          <dd class="font-medium">{{ app.creditApplicationReference }}</dd>
        </div>
        <div>
          <dt class="text-muted">Application Date</dt>
          <dd class="font-medium">{{ dash(crbToLong(app.creditApplicationDate)) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Term</dt>
          <dd class="font-medium">{{ dash(termText(app.Term, app.TermPeriod)) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Status</dt>
          <dd class="font-medium">{{ ref_.label('application-statuses', app.creditApplicationStatus) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Loan Type</dt>
          <dd class="font-medium">
            {{ dash(ref_.label('loan-product-types', app.creditAccountLoanProductType)) }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">Purpose</dt>
          <dd class="font-medium">{{ dash(ref_.label('loan-purposes', app.loanPurpose)) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Branch</dt>
          <dd class="font-medium">{{ dash(ref_.branchName(app.branchCode)) }}</dd>
        </div>
      </dl>
    </div>

    <div class="card p-6">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-project">Full Loan Details</h2>
        <button type="button" class="btn-outline" :aria-expanded="showAll" @click="showAll = !showAll">
          Show / Hide
        </button>
      </div>
      <div v-if="showAll" class="mt-4 grid gap-6 lg:grid-cols-3">
        <table v-for="g in groups" :key="g.title" class="w-full self-start text-left text-sm">
          <caption class="mb-1 text-left text-xs font-semibold uppercase text-muted">
            {{
              g.title
            }}
          </caption>
          <tbody>
            <tr v-for="[label, value] in g.rows" :key="label" class="border-t border-slate-100">
              <th class="py-1.5 pr-3 font-normal text-slate-500">{{ label }}</th>
              <td class="py-1.5">{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
