<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalConfirm, swalNotification, swalOk } from '@/utils/dialogs'
import { loansApi } from './api'
import LoanList from './components/LoanList.vue'
import { parseContractCodes } from './loanModel'
import type { LoanRow } from './types'

/** /ignored-accounts: loans the CBA leaves out, with Add Accounts and Remove (cba/ignore_accounts.blade.php). */
const list = ref<InstanceType<typeof LoanList> | null>(null)
const item = 'block px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100 cursor-pointer'

async function addAccounts() {
  const answer = await swalOk.fire({
    title: 'Enter Loan Contract Codes',
    html: '<p class="text-danger">These loan accounts will not appear in the CBA!</p>',
    input: 'textarea',
    inputPlaceholder: 'Enter contract codes separated by commas',
    inputAttributes: { 'aria-label': 'Contract codes' },
    showCancelButton: true,
    confirmButtonText: 'Submit Accounts',
    reverseButtons: true,
    preConfirm: (value: string) => {
      if (!value || !value.trim()) {
        swalOk.showValidationMessage('Please enter at least one contract code')
        return false
      }
      return value
    },
  })
  if (!answer.isConfirmed || typeof answer.value !== 'string') return
  showLoader('ignoring...')
  try {
    const result = await loansApi.ignore(parseContractCodes(answer.value))
    hideLoader()
    await swalNotification('success', result.message)
    await list.value?.reload()
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'Error while ignoring loan accounts!'))
  }
}

async function remove(loan: LoanRow) {
  const answer = await swalConfirm.fire({
    icon: 'warning',
    text: 'You are about to remove this account from the ignored loans. This loan will appear in the CBA. Proceed?',
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('removing...')
  try {
    const result = await loansApi.unignore(loan.contractCode)
    hideLoader()
    await swalNotification('success', result.message)
    await list.value?.reload()
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'Error while ignoring loan accounts!'))
  }
}
</script>

<template>
  <LoanList ref="list" url="/ignored-accounts" name-class="text-danger">
    <template #breadcrumb>
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CBA / Ignored Accounts
    </template>
    <template #toolbar>
      <button type="button" class="btn-primary-1" @click="addAccounts">+ Add Accounts</button>
    </template>
    <template #actions="{ loan }">
      <div class="flex">
        <RouterLink :to="`/loans/show/${loan.id}`" class="btn-outline rounded-r-none"
          >Loan Details</RouterLink
        >
        <DropdownMenuRoot>
          <DropdownMenuTrigger class="btn-outline rounded-l-none border-l-0" aria-label="More actions"
            >▾</DropdownMenuTrigger
          >
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              class="z-50 min-w-44 rounded border border-slate-200 bg-white py-1 shadow-lg"
            >
              <DropdownMenuItem as-child>
                <RouterLink :to="`/loans/show/${loan.id}`" :class="item">Add Security</RouterLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="my-1 h-px bg-slate-100" />
              <DropdownMenuItem :class="[item, 'text-danger']" @select="remove(loan)"
                >Remove</DropdownMenuItem
              >
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </template>
  </LoanList>
</template>
