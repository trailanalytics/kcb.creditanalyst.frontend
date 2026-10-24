<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import FixTab from './components/FixTab.vue'
import type { FixKind } from './fixModel'

/** /cba/fix: delete records that were already reported, and correct customer details from a file (CbaFix.vue). */
const tab = ref<FixKind>('delete')
const tabs: { kind: FixKind; label: string }[] = [
  { kind: 'delete', label: 'Delete Reported Records' },
  { kind: 'customer', label: 'Fix Customer Details' },
]
</script>

<template>
  <section class="mx-auto max-w-6xl px-2 pb-8">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/loans" class="text-primary-1">CBA</RouterLink> / Fix CBA Issues
    </nav>
    <div class="card">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <h2 class="text-base font-bold text-project">
          <span class="mr-2 text-primary-1">🛠</span>Fix CBA Issues
        </h2>
        <RouterLink to="/background-processes" class="btn-outline px-3 py-1 text-xs"
          >Background Processes</RouterLink
        >
      </div>
      <div class="px-6 py-5">
        <div class="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.kind"
            type="button"
            role="tab"
            class="-mb-px border border-transparent px-4 py-2 text-sm"
            :class="
              tab === t.kind
                ? 'rounded-t border-slate-200 border-b-white bg-white font-semibold text-project'
                : 'text-slate-500 hover:text-project'
            "
            :aria-selected="tab === t.kind"
            @click="tab = t.kind"
          >
            <span :class="t.kind === 'delete' ? 'text-danger' : 'text-primary-1'">{{
              t.kind === 'delete' ? '🗑' : '✎'
            }}</span>
            {{ t.label }}
          </button>
        </div>
        <!-- both tabs stay mounted so a chosen file survives switching -->
        <div v-show="tab === 'delete'" role="tabpanel"><FixTab kind="delete" /></div>
        <div v-show="tab === 'customer'" role="tabpanel"><FixTab kind="customer" /></div>
      </div>
    </div>
  </section>
</template>
