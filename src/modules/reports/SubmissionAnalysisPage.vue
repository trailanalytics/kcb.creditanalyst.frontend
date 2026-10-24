<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { messageOf } from '@/api/http'
import { blobFailure, filenameOf, saveBlob } from '@/modules/loans/download'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import AnalysisTable from './components/AnalysisTable.vue'
import { reportsApi } from './api'
import { accountName, codeLine, money, visibleSections } from './analysisModel'
import type { AnalysisRow, BranchRow, CodeLabelRow, SubmissionAnalysis } from './types'

/** /reports/submission-analysis[/download]: what the last generated PIS, BC, CAP and CBA files hold (submission_analysis.blade.php). */
const props = defineProps<{ id?: string }>()
const data = ref<SubmissionAnalysis | null>(null)
const loadFailure = ref('')
const sections = computed(() => (data.value ? visibleSections(data.value) : null))

const byLabel = (rows: CodeLabelRow[]): AnalysisRow[] =>
  rows.map((r, i) => ({
    key: `${r.code}-${i}`,
    first: r.label,
    sub: codeLine(r.code),
    cells: [money(r.count)],
  }))
const byBranch = (rows: BranchRow[]): AnalysisRow[] =>
  rows.map((r, i) => ({
    key: `${r.code}-${i}`,
    first: r.name,
    sub: codeLine(r.code),
    cells: [money(r.count)],
  }))

async function downloadPdf() {
  showLoader('Preparing the report...')
  try {
    const response = await reportsApi.analysisPdf()
    saveBlob(response.data, filenameOf(response.headers, 'submission_analysis.pdf'))
    hideLoader()
  } catch (e) {
    hideLoader()
    await swalNotification('error', await blobFailure(e, 'The report could not be downloaded.'))
  }
}

onMounted(async () => {
  try {
    data.value = await reportsApi.analysis()
  } catch (e) {
    loadFailure.value = messageOf(e, 'The analysis could not be loaded.')
    return
  }
  // /reports/submission-analysis/download also saves the PDF, as before
  if (props.id === 'download') await downloadPdf()
})
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Reports /
        <b class="text-ink">Submission Analysis</b>
      </nav>
      <button type="button" class="btn-primary-1 ml-auto" data-testid="pdf" @click="downloadPdf">
        Download Report
      </button>
    </div>

    <p v-if="loadFailure" class="text-danger">{{ loadFailure }}</p>

    <div v-else-if="data && sections" class="card px-6 py-8">
      <section v-if="sections.stakeholders" class="mb-10" data-testid="stakeholders">
        <div class="mb-3 flex items-center gap-3">
          <img src="/img/icons/guarantor.png" alt="" width="48" />
          <div>
            <h2 class="text-lg font-bold">
              Participating Institution Stakeholders ({{ money(data.stakeholders.count) }})
            </h2>
            <small class="text-muted">As of: {{ data.stakeholders.as_of }}</small>
          </div>
        </div>
        <AnalysisTable
          caption="Bank Stakeholders"
          :headers="['Name', 'Category', '%']"
          first-width="40%"
          :rows="
            data.stakeholders.rows.map((r, i) => ({
              key: `${r.name}-${i}`,
              first: r.name,
              cells: [r.category, r.percentage],
            }))
          "
        />
      </section>

      <section v-if="sections.bounced" class="mb-10" data-testid="bounced">
        <div class="mb-3 flex items-center gap-3">
          <img src="/img/icons/cheque.png" alt="" width="48" />
          <div>
            <h2 class="text-lg font-bold">Bounced Cheques ({{ money(data.bounced_cheques.count) }})</h2>
            <small class="block text-muted">Minimum date: {{ data.bounced_cheques.min_date }}</small>
            <small class="block text-muted">Maximum date: {{ data.bounced_cheques.max_date }}</small>
          </div>
        </div>
        <AnalysisTable
          caption="BC by Currency"
          :headers="['Currency', 'Cheques Bounced']"
          first-width="70%"
          :rows="
            data.bounced_cheques.by_currency.map((r) => ({
              key: r.currency,
              first: r.currency,
              cells: [money(r.count)],
            }))
          "
        />
        <AnalysisTable
          caption="BC by Branch"
          :headers="['Name', 'Cheques Bounced']"
          first-width="70%"
          :rows="byBranch(data.bounced_cheques.by_branch)"
        />
        <AnalysisTable
          caption="Bounced Cheques by Reason"
          :headers="['Reason', 'Cheques Bounced']"
          first-width="70%"
          :rows="byLabel(data.bounced_cheques.by_reason)"
        />
      </section>

      <section v-if="sections.applications" class="mb-10" data-testid="applications">
        <div class="mb-3 flex items-center gap-3">
          <img src="/img/icons/credit.png" alt="" width="48" />
          <div>
            <h2 class="text-lg font-bold">
              Credit Applications ({{ money(data.credit_applications.count) }})
            </h2>
            <small class="block text-muted">Minimum date: {{ data.credit_applications.min_date }}</small>
            <small class="block text-muted">Maximum date: {{ data.credit_applications.max_date }}</small>
          </div>
        </div>
        <AnalysisTable
          caption="Caps by Currency"
          :headers="['Currency', 'Credit Applications', 'Value']"
          first-width="40%"
          :rows="
            data.credit_applications.by_currency.map((r) => ({
              key: r.currency,
              first: r.currency,
              cells: [money(r.count), money(r.amount)],
            }))
          "
        />
        <AnalysisTable
          caption="Caps by Branch"
          :headers="['Name', 'Credit Applications']"
          first-width="70%"
          :rows="byBranch(data.credit_applications.by_branch)"
        />
        <AnalysisTable
          caption="Caps by Product Type"
          :headers="['Product Type', 'Credit Applications']"
          first-width="70%"
          :rows="byLabel(data.credit_applications.by_product)"
        />
        <AnalysisTable
          caption="Caps by Status"
          :headers="['CAP status', 'Credit Applications']"
          first-width="70%"
          :rows="byLabel(data.credit_applications.by_status)"
        />
      </section>

      <section v-if="sections.accounts" data-testid="accounts">
        <div class="mb-3 flex items-center gap-3">
          <img src="/img/icons/manage.png" alt="" width="48" />
          <div>
            <h2 class="text-lg font-bold">
              Credit Borrower Accounts ({{ money(data.credit_accounts.count) }})
            </h2>
            <small class="block text-muted">Minimum date: {{ data.credit_accounts.min_date }}</small>
            <small class="block text-muted">Maximum date: {{ data.credit_accounts.max_date }}</small>
          </div>
        </div>
        <AnalysisTable
          caption="CBA by Currency"
          :headers="['Currency', 'CBA records', 'Balance/Exposure']"
          first-width="40%"
          :rows="
            data.credit_accounts.by_currency.map((r) => ({
              key: r.currency,
              first: r.currency,
              cells: [money(r.count), money(r.balance)],
            }))
          "
        />
        <AnalysisTable
          caption="CBA by Branch"
          :headers="['Name', 'CBA records']"
          :rows="byBranch(data.credit_accounts.by_branch)"
        />
        <AnalysisTable
          caption="CBA by Product Type"
          :headers="['Product Type', 'CBA records']"
          :rows="byLabel(data.credit_accounts.by_product)"
        />
        <AnalysisTable
          caption="CBA by Status"
          :headers="['Status', 'CBA records']"
          :rows="byLabel(data.credit_accounts.by_status)"
        />
        <AnalysisTable
          caption="CBA by Risk Classification"
          :headers="['Risk Classification', 'CBA records']"
          :rows="byLabel(data.credit_accounts.by_risk)"
        />
        <AnalysisTable
          caption="10 largest Credit Accounts by Amount Disbursed/Approved"
          :headers="['Account', 'Amount']"
          first-width="70%"
          :rows="
            data.credit_accounts.largest.map((r, i) => ({
              key: `${r.reference}-${i}`,
              first: accountName(r.name),
              sub: `Contract: ${r.reference}`,
              cells: [`${money(r.amount)} ${r.currency}`],
            }))
          "
        />
        <AnalysisTable
          caption="10 Worst Credit Accounts by Days in Arrears"
          :headers="['Account', 'Days']"
          first-width="90%"
          :rows="
            data.credit_accounts.worst.map((r, i) => ({
              key: `${r.reference}-${i}`,
              first: accountName(r.name),
              sub: `Contract: ${r.reference}`,
              cells: [money(r.days)],
            }))
          "
        />
      </section>
    </div>
  </section>
</template>
