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
import { useAuthStore } from '@/stores/auth'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { loansApi } from './api'
import LoanList from './components/LoanList.vue'
import type { LoanRow } from './types'

/** /loans: the CBA loan list (cba/index.blade.php + LoanIndex.vue). */
const auth = useAuthStore()
const list = ref<InstanceType<typeof LoanList> | null>(null)
const item = 'block px-4 py-2 text-sm outline-none data-[highlighted]:bg-slate-100 cursor-pointer'

async function ignore(loan: LoanRow) {
  const answer = await swalConfirm.fire({
    icon: 'warning',
    title: 'Are you sure?',
    text: `The loan ${loan.contractCode} will no longer appear in the CBA`,
    showCancelButton: true,
    confirmButtonText: 'Yes, ignore it!',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('ignoring...')
  try {
    await loansApi.ignore([loan.contractCode])
    hideLoader()
    await swalNotification('success', 'Account Ignored Successfully!')
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'Error while ignoring loan accounts!'))
  }
}
</script>

<template>
  <LoanList ref="list" url="/loans">
    <template #breadcrumb> <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Loans </template>
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
              class="z-50 min-w-48 rounded border border-slate-200 bg-white py-1 shadow-lg"
            >
              <DropdownMenuItem as-child>
                <RouterLink :to="`/loans/show/${loan.id}`" :class="item">Add Security</RouterLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="my-1 h-px bg-slate-100" />
              <DropdownMenuItem as-child>
                <RouterLink :to="`/loans/repayments/${loan.id}`" :class="item">Repayments</RouterLink>
              </DropdownMenuItem>
              <template v-if="auth.has('Write-off Accounts')">
                <DropdownMenuSeparator class="my-1 h-px bg-slate-100" />
                <DropdownMenuItem as-child>
                  <RouterLink :to="`/loans/write-off/${loan.id}`" :class="[item, 'text-danger']"
                    >Write Off Account</RouterLink
                  >
                </DropdownMenuItem>
              </template>
              <template v-if="auth.has('Ignore Accounts')">
                <DropdownMenuSeparator class="my-1 h-px bg-slate-100" />
                <DropdownMenuItem :class="[item, 'text-danger']" @select="ignore(loan)"
                  >Ignore Account</DropdownMenuItem
                >
              </template>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </template>
  </LoanList>
</template>
