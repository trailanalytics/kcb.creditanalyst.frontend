<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { messageOf } from '@/api/http'
import { hideLoader, showLoader } from '@/utils/dialogs'
import { analysisApi } from './api'
import { resultLines } from './analysisModel'
import type { AnalysisResults } from './types'

/** /analysis/pr4/results: the outcome of the latest PR4 against CBA analysis (PR4Results.vue). `?batch_id=` shows one upload's. */
const route = useRoute()
const results = ref<AnalysisResults | null>(null)
const loaded = ref(false)
const failure = ref<string | null>(null)

const lines = computed(() => (results.value ? resultLines(results.value) : []))
const month = computed(() =>
  results.value?.reporting_month ? dayjs(results.value.reporting_month).format('D MMM YYYY') : null,
)

onMounted(async () => {
  const batch = Number(route.query.batch_id)
  showLoader('loading results...')
  try {
    results.value = await analysisApi.results(Number.isInteger(batch) && batch > 0 ? batch : undefined)
  } catch (e) {
    // the old page left the spinner up for ever
    failure.value = messageOf(e, 'The results could not be loaded. Please try again.')
  } finally {
    hideLoader()
    loaded.value = true
  }
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-2">
    <nav class="mb-4 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/analysis" class="text-primary-1">Analysis</RouterLink> / Results
    </nav>
    <div class="card p-6">
      <template v-if="loaded">
        <div
          v-if="failure"
          class="rounded border border-red-200 bg-red-50 p-4 text-sm text-danger"
          role="alert"
        >
          {{ failure }}
        </div>
        <template v-else-if="results">
          <div
            class="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            role="status"
          >
            ✓ Pr4 Report File Analyzed against the CBA successfully!
          </div>
          <p class="font-bold">Results of the analysis</p>
          <p v-if="month" class="mb-2 text-sm text-muted" data-testid="month">Reporting month: {{ month }}</p>
          <ol class="list-decimal space-y-3 pl-6 text-sm" data-testid="results">
            <li
              v-for="line in lines"
              :key="line.key"
              :class="[
                line.danger ? 'text-danger' : '',
                line.divider ? 'border-b border-slate-200 pb-3' : '',
              ]"
              :data-testid="`line-${line.key}`"
            >
              <template v-for="(part, i) in line.parts" :key="i"
                ><b v-if="part.bold">{{ part.text }}</b
                ><template v-else>{{ part.text }}</template></template
              >
            </li>
          </ol>
        </template>
        <div v-else class="py-8 text-center text-sm text-muted" data-testid="empty">
          <p class="font-medium text-slate-700">No analysis has been run yet.</p>
          <p class="mt-1">
            Upload a PR4 file and choose <i>ANALYZE PR4 AGAINST CBA</i> on the
            <RouterLink to="/analysis" class="text-primary-1">Analysis page</RouterLink>.
          </p>
        </div>
      </template>
    </div>
  </section>
</template>
