<script setup lang="ts">
import CustomerHeader from '@/modules/customer/components/CustomerHeader.vue'
import type { LoanView } from '../types'

/**
 * The card at the top of the loan details, repayments and write-off pages (x-loan-header): the borrower on the left and the
 * loan's facts in a grid. `extra` adds the arrears facts the write-off page shows. The `actions` slot is for page buttons.
 */
defineProps<{ view: LoanView; extra?: boolean }>()
const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
</script>

<template>
  <div class="card mb-6 p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <CustomerHeader :customer="view.customer" />
      <div class="flex flex-wrap gap-2"><slot name="actions" /></div>
    </div>
    <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="loan-facts">
      <div>
        <dt class="text-muted">Amount</dt>
        <dd class="font-medium">{{ view.header.amount }}</dd>
      </div>
      <div>
        <dt class="text-muted">Contract Code</dt>
        <dd class="font-medium">{{ view.header.contractCode }}</dd>
      </div>
      <div>
        <dt class="text-muted">Contract Date</dt>
        <dd class="font-medium">{{ dash(view.header.contractDate) }}</dd>
      </div>
      <div>
        <dt class="text-muted">Maturity Date</dt>
        <dd class="font-medium">{{ dash(view.header.maturityDate) }}</dd>
      </div>
      <div>
        <dt class="text-muted">Current Balance</dt>
        <dd class="font-medium">{{ view.header.currentBalance }}</dd>
      </div>
      <div>
        <dt class="text-muted">Status</dt>
        <dd class="font-medium">{{ dash(view.header.status) }}</dd>
      </div>
      <div>
        <dt class="text-muted">Loan Type</dt>
        <dd class="font-medium">{{ dash(view.header.loanType) }}</dd>
      </div>
      <div>
        <dt class="text-muted">Purpose</dt>
        <dd class="font-medium">{{ dash(view.header.purpose) }}</dd>
      </div>
      <template v-if="extra">
        <div>
          <dt class="text-muted">Due Days</dt>
          <dd class="font-medium">{{ dash(view.header.dueDays) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Balance Overdue</dt>
          <dd class="font-medium">{{ view.header.balanceOverdue }}</dd>
        </div>
        <div>
          <dt class="text-muted">Arrear Date</dt>
          <dd class="font-medium">{{ dash(view.header.arrearsDate) }}</dd>
        </div>
      </template>
    </dl>
  </div>
</template>
