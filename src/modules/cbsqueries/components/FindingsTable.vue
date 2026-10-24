<script setup lang="ts">
import { canApplySuggestion } from '../suggestion'
import type { Finding } from '../types'
import SeverityBadge from './SeverityBadge.vue'

/**
 * Validation findings, in the order the validator gave them (by position). `applicable` turns "Apply suggestion" on for the
 * rows that have an expected alias; the editor switches it off while the findings are older than the text.
 */
defineProps<{ findings: Finding[]; applicable?: boolean; showApply?: boolean; empty?: string }>()
const emit = defineEmits<{ apply: [finding: Finding] }>()
</script>

<template>
  <p v-if="!findings.length" class="px-4 py-3 text-sm text-muted" data-testid="no-findings">
    {{ empty ?? 'No findings.' }}
  </p>
  <div v-else class="overflow-x-auto">
    <table class="w-full text-left text-sm" data-testid="findings">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-3 py-2">Severity</th>
          <th class="px-3 py-2">Column</th>
          <th class="px-3 py-2">Message</th>
          <th class="px-3 py-2">Found</th>
          <th class="px-3 py-2">Expected alias</th>
          <th v-if="showApply" class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in findings"
          :key="f.ordinal"
          class="border-t border-slate-100 align-top"
          :data-testid="`finding-${f.ordinal}`"
        >
          <td class="px-3 py-2"><SeverityBadge :severity="f.severity" /></td>
          <td class="px-3 py-2" data-testid="finding-column">{{ f.columnPosition ?? '' }}</td>
          <td class="px-3 py-2" data-testid="finding-message">
            {{ f.message }}
            <small class="block text-xs text-muted">{{ f.code }}</small>
          </td>
          <td class="px-3 py-2">
            <code v-if="f.foundText" class="rounded bg-slate-100 px-1 text-xs" data-testid="finding-found">{{
              f.foundText
            }}</code>
          </td>
          <td class="px-3 py-2">
            <code
              v-if="f.expectedAlias"
              class="rounded bg-emerald-50 px-1 text-xs"
              data-testid="finding-expected"
              >{{ f.expectedAlias }}</code
            >
          </td>
          <td v-if="showApply" class="whitespace-nowrap px-3 py-2">
            <button
              v-if="canApplySuggestion(f)"
              type="button"
              class="btn-outline !px-3 !py-1 text-xs"
              :disabled="!applicable"
              data-testid="apply"
              @click="emit('apply', f)"
            >
              Apply suggestion
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
