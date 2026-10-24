<script setup lang="ts">
/** One captioned table of the analysis: a first cell with an optional "code: x" line, then right-hand cells. */
import type { AnalysisRow } from '../types'

defineProps<{ caption: string; headers: string[]; rows: AnalysisRow[]; firstWidth?: string }>()
</script>

<template>
  <div class="mb-6" data-testid="analysis-table">
    <strong class="mb-1 block text-sm">{{ caption }}</strong>
    <table class="w-full text-left text-sm">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th
            v-for="(h, i) in headers"
            :key="h"
            class="px-3 py-2"
            :class="i > 0 ? 'text-right' : ''"
            :style="i === 0 && firstWidth ? { width: firstWidth } : undefined"
          >
            {{ h }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key" class="border-t border-slate-100">
          <td class="px-3 py-2">
            {{ r.first
            }}<template v-if="r.sub"
              ><br /><small class="text-muted">{{ r.sub }}</small></template
            >
          </td>
          <td v-for="(c, i) in r.cells" :key="i" class="px-3 py-2 text-right">{{ c }}</td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="headers.length" class="px-3 py-2 text-muted">No records</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
