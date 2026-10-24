<script setup lang="ts">
import { formatNumber } from '@/utils/format'
import { isExpired, timeLeftText } from '../outputModel'
import type { OutputFileRow } from '../types'

/** The submitted-files list: active rows with the time left and a download icon, expired rows in red with the icon disabled. */
defineProps<{ rows: OutputFileRow[] }>()
defineEmits<{ download: [row: OutputFileRow] }>()
</script>

<template>
  <div class="card mt-3 px-4 py-5">
    <table class="w-full text-left text-sm shadow">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-3 py-2" style="width: 40%">File</th>
          <th class="px-3 py-2" title="Number of Records affected by the rule">Records</th>
          <th class="px-3 py-2" title="BOU Report Version">Version</th>
          <th class="px-3 py-2" colspan="2" title="Report Submission Date">Submission Date</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
          class="border-t border-slate-100 odd:bg-slate-50/50"
          data-testid="output-row"
        >
          <td class="px-3 py-2">
            <template v-if="!isExpired(r)">
              <span title="Download File">{{ r.rule_name }}</span>
              <span class="ml-1 text-danger" data-testid="time-left">
                <b>{{ timeLeftText(r) }}</b>
              </span>
            </template>
            <span v-else class="text-danger" title="Download Not Available" data-testid="expired">{{
              r.rule_name
            }}</span>
          </td>
          <td class="px-3 py-2">{{ formatNumber(r.records_count) }}</td>
          <td class="px-3 py-2">{{ r.version }}</td>
          <td class="px-3 py-2">{{ r.submission_date }}</td>
          <td class="px-3 py-2 text-right">
            <button
              v-if="!isExpired(r)"
              type="button"
              class="text-primary-1"
              title="Download File"
              :aria-label="`Download ${r.rule_name}`"
              @click="$emit('download', r)"
            >
              ⬇
            </button>
            <span
              v-else
              class="cursor-not-allowed text-danger"
              title="Download Not Available"
              aria-disabled="true"
              >⬇</span
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
