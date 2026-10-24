<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteButton from '@/modules/requests/components/DeleteButton.vue'
import { requestDeletion } from '@/modules/requests/deletionFlow'
import TransferDialog from './components/TransferDialog.vue'
import type { BankBranch } from './types'

/** /branches: the bank's branches, newest first, with the customer transfer (branches/index.blade.php + IbIndex.vue). */
const auth = useAuthStore()
const { items, loading, completed, loadMore, reload, updateItem } =
  useCollection<BankBranch>('/bank-branches')
const transferOpen = ref(false)
onMounted(loadMore)

async function remove(b: BankBranch) {
  if (await requestDeletion('branch', b.id)) updateItem({ id: b.id, is_deleted: true })
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / Branches
      </nav>
      <div class="ml-auto flex gap-3">
        <RouterLink v-if="auth.has('Create Branches')" to="/branches/new" class="btn-primary-1"
          >New Branch</RouterLink
        >
        <button
          v-if="auth.has('Update Branches')"
          type="button"
          class="btn-primary-1"
          @click="transferOpen = true"
        >
          Transfer Branch Customers
        </button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Branch Name</th>
            <th class="px-4 py-3">Bank Issued Code</th>
            <th class="px-4 py-3">BOU Issued Code</th>
            <th class="px-4 py-3">Date Opened</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in items" :key="b.id" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
            <td class="px-4 py-3">{{ b.BranchName }}</td>
            <td class="px-4 py-3">{{ b.bankBranchCode }}</td>
            <td class="px-4 py-3">{{ b.BranchIdentificationCode }}</td>
            <td class="px-4 py-3">{{ b.DateOpened }}</td>
            <td class="px-4 py-3 text-right">
              <span
                v-if="b.is_deleted"
                class="text-danger"
                title="This record has been requested to be deleted!"
                >⚑</span
              >
              <template v-else>
                <RouterLink
                  v-if="auth.has('Update Branches')"
                  :to="`/branches/edit/${b.id}`"
                  class="text-primary-1"
                  :aria-label="`Edit ${b.BranchName}`"
                  >✎</RouterLink
                >
                <DeleteButton
                  v-if="auth.has('Delete Branches')"
                  :label="`Request deletion of ${b.BranchName}`"
                  @click="remove(b)"
                />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <InfiniteScroll
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No results found."
      @load="loadMore"
    />
    <TransferDialog v-model:open="transferOpen" @done="reload" />
  </section>
</template>
