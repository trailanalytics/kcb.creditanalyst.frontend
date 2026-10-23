<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import type { CustomerRow } from './types'

/** Profiles list (borrowers/index.blade.php + ProfileIndex.vue): infinite list of customers, searchable. */
const { items, search, loading, completed, error, loadMore } = useCollection<CustomerRow>('/profiles')
onMounted(loadMore)
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold text-project">Profiles</h1>
      <div class="relative ml-auto w-96 max-w-full">
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, client no, FCS no..."
          class="form-input pr-8"
          aria-label="Search profiles"
        />
        <button
          v-if="search"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-muted"
          aria-label="Clear search"
          @click="search = ''"
        >
          ×
        </button>
      </div>
      <RouterLink to="/find-in-t24" class="btn-primary-1">Import from T24</RouterLink>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Borrower</th>
            <th class="px-4 py-3">Client No</th>
            <th class="px-4 py-3">FCS No</th>
            <th class="px-4 py-3">Classification</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in items" :key="c.id" class="border-t border-slate-100 hover:bg-[#F7FAFC]">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img src="/img/profile-placeholder.jpg" alt="" width="60" class="rounded" />
                <div>
                  <RouterLink :to="`/borrowers/${c.id}`" class="font-medium text-project">{{
                    c.full_name.trim() || 'Unnamed customer'
                  }}</RouterLink>
                  <div class="text-xs text-muted">Running Loans: 00</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">{{ c.clientNumber }}</td>
            <td class="px-4 py-3">{{ c.II_FCSNumber }}</td>
            <td class="px-4 py-3">{{ c.customer_type }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="py-4 text-center text-sm text-danger">
      Failed to load profiles. Please refresh and try again.
    </p>
    <InfiniteScroll
      v-else
      :loading="loading"
      :completed="completed"
      :is-empty="items.length === 0"
      empty-text="No profiles found."
      @load="loadMore"
    />
  </section>
</template>
