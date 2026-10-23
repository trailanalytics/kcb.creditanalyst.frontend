<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useCollection } from '@/composables/useCollection'
import { useAuthStore } from '@/stores/auth'
import { formatNumber } from '@/utils/format'
import PartyBlock from './components/PartyBlock.vue'
import PartyModal from './components/PartyModal.vue'
import type { GuarantorRow, PartyStart } from './types'

/**
 * /ccg-list: guarantors of every borrower (ccg/index.blade.php + CcgIndex.vue). There is no "add" here, guarantors are added from a
 * credit application or loan page; this edits. Deleting goes through a deletion request (milestone 7) and is not offered yet.
 */
const auth = useAuthStore()
const { items, search, loading, completed, error, loadMore, reload } =
  useCollection<GuarantorRow>('/guarantors')
onMounted(loadMore)

const dialog = reactive<{ open: boolean; start: PartyStart; version: number }>({
  open: false,
  start: { mode: 'new', classification: '0' },
  version: 0,
})
function edit(row: GuarantorRow) {
  dialog.start = { mode: 'edit', row }
  dialog.version += 1
  dialog.open = true
}
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> / CCG
      </nav>
      <input
        v-model="search"
        type="text"
        placeholder="search..."
        class="form-input ml-auto w-72"
        aria-label="Search guarantors"
      />
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Guarantor#</th>
            <th class="px-4 py-3">Value</th>
            <th class="px-4 py-3">Borrower</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in items" :key="g.id" class="border-t border-slate-100 align-top hover:bg-[#F7FAFC]">
            <td class="px-4 py-3"><PartyBlock :profile="g.guarantor_profile" strong /></td>
            <td class="px-4 py-3">{{ formatNumber(g.valueOfGuarantorCollateral) }}</td>
            <td class="px-4 py-3"><PartyBlock :profile="g.borrower" /></td>
            <td class="px-4 py-3 text-right">
              <span
                v-if="g.is_deleted"
                class="text-danger"
                title="This record has been requested to be deleted!"
                role="img"
                aria-label="Deletion requested"
                >⚑</span
              >
              <button
                v-else-if="auth.has('Update Guarantors')"
                type="button"
                class="text-slate-500 hover:text-project"
                :aria-label="`Edit guarantor ${g.GuarantorClientNumber}`"
                @click="edit(g)"
              >
                ✎
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="py-4 text-center text-sm text-danger">
      Failed to load guarantors. Please refresh and try again.
    </p>
    <InfiniteScroll
      v-else
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No guarantors found."
      @load="loadMore"
    />

    <PartyModal
      v-model:open="dialog.open"
      kind="guarantor"
      :start="dialog.start"
      :version="dialog.version"
      @saved="reload()"
    />
  </section>
</template>
