<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import { http } from '@/api/http'

/** Top-bar search (SearchComponent.vue): customers, credit applications and loans, 8 of each at most. */
interface Item {
  title: string
  subtitle: string
  badge: string
  url: string
  action: { label: string; url: string } | null
}
interface Results {
  customers: Item[]
  applications: Item[]
  loans: Item[]
}

const query = ref('')
const results = ref<Results | null>(null)
const loading = ref(false)
const open = ref(false)
const root = ref<HTMLElement | null>(null)
let searchId = 0

const groups = computed(() =>
  results.value
    ? [
        { title: 'Customers', items: results.value.customers },
        { title: 'Credit applications (CAP)', items: results.value.applications },
        { title: 'Loans', items: results.value.loans },
      ].filter((g) => g.items.length)
    : [],
)

const run = useDebounceFn(async () => {
  const typed = query.value.trim()
  if (typed.replace(/ /g, '').length < 2) {
    results.value = null
    open.value = false
    loading.value = false
    return
  }
  const mine = ++searchId
  loading.value = true
  open.value = true
  try {
    const { data } = await http.get<Results>('/search', {
      params: { query: typed },
      headers: { 'x-handled': '1' },
    })
    if (mine === searchId) results.value = data
  } catch {
    // a 403 or any failure reads as "no results"
    if (mine === searchId) results.value = { customers: [], applications: [], loans: [] }
  } finally {
    if (mine === searchId) loading.value = false
  }
}, 500)

onClickOutside(root, () => (open.value = false))
const close = () => (open.value = false)
</script>

<template>
  <div ref="root" class="relative w-full max-w-xl">
    <input
      v-model="query"
      type="search"
      placeholder="Search customers, CAPs and loans..."
      title="Name, client number, account number, FCS number, NIN, registration number, CAP reference or loan contract code"
      class="w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/60 focus:bg-white focus:text-ink focus:placeholder-slate-400 focus:outline-none"
      aria-label="Search customers, CAPs and loans"
      @input="run"
      @focus="results && (open = true)"
    />
    <span v-if="loading" class="absolute right-3 top-2 text-xs text-slate-400">…</span>
    <div
      v-if="open"
      class="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-3 text-ink shadow-lg"
      role="listbox"
    >
      <p v-if="loading && !results" class="py-2 text-center text-sm text-muted">loading…</p>
      <template v-else-if="groups.length">
        <section v-for="g in groups" :key="g.title" class="mb-2">
          <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{{ g.title }}</h4>
          <div v-for="(item, i) in g.items" :key="item.url" class="group relative">
            <hr v-if="i > 0" class="my-1" />
            <RouterLink :to="item.url" class="block font-medium text-project" @click="close">{{
              item.title
            }}</RouterLink>
            <div class="flex justify-between gap-3 text-xs">
              <span class="text-slate-500">{{ item.subtitle }}</span>
              <b class="shrink-0">{{ item.badge }}</b>
            </div>
            <RouterLink
              v-if="item.action"
              :to="item.action.url"
              class="btn-primary-1 absolute right-0 top-1/2 hidden -translate-y-1/2 !rounded-full !px-3 !py-1 text-xs group-hover:inline-flex"
              @click="close"
              >{{ item.action.label }}</RouterLink
            >
          </div>
        </section>
      </template>
      <p v-else class="py-2 text-center text-sm text-muted">
        No customers, CAPs or loans match "{{ query.trim() }}"
      </p>
    </div>
  </div>
</template>
