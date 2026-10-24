<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCollection } from '@/composables/useCollection'
import InfiniteScroll from '@/components/ui/InfiniteScroll.vue'
import { useAuthStore } from '@/stores/auth'
import DeleteButton from '@/modules/requests/components/DeleteButton.vue'
import { requestDeletion } from '@/modules/requests/deletionFlow'
import type { UserRow } from './types'

const auth = useAuthStore()
const { items, search, loading, completed, loadMore, updateItem } = useCollection<UserRow>('/users')
onMounted(loadMore)

async function remove(u: UserRow) {
  if (await requestDeletion('user', u.id)) updateItem({ id: u.id, pendingDeletion: true })
}

const fullName = (u: UserRow) => `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim()
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold text-project">Users</h1>
      <input
        v-model="search"
        type="search"
        placeholder="Search by name or exact email"
        class="ml-auto w-72 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-1 focus:outline-none"
        aria-label="Search users"
      />
      <RouterLink
        v-if="auth.has('Create, Update and Delete Users')"
        :to="{ name: 'user-new' }"
        class="rounded bg-project px-4 py-2 text-sm font-medium text-white"
      >
        + New User
      </RouterLink>
    </div>

    <div class="overflow-x-auto rounded border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Role</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in items" :key="u.id" class="border-t border-slate-100">
            <td class="px-4 py-3">{{ fullName(u) }}</td>
            <td class="px-4 py-3">{{ u.email }}</td>
            <td class="px-4 py-3">{{ u.role }}</td>
            <td class="px-4 py-3">
              <span :class="u.status === 'disabled' ? 'text-danger' : 'text-success'">{{ u.status }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <span
                v-if="u.pendingDeletion"
                class="text-danger"
                title="This user has been requested to be deleted!"
                >⚑</span
              >
              <template v-else-if="auth.has('Create, Update and Delete Users')">
                <RouterLink
                  :to="{ name: 'user-edit', params: { id: u.id } }"
                  class="text-primary-1 underline"
                >
                  Edit
                </RouterLink>
                <DeleteButton :label="`Request deletion of ${fullName(u) || u.email}`" @click="remove(u)" />
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
      @load="loadMore"
    />
  </section>
</template>
