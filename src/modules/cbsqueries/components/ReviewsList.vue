<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { statusInfo, TONE_CLASS, whenText } from '../statusModel'
import type { Review } from '../types'

/** Earlier reviews, newest first as the server gave them, each with its recommendations and the version that applied them. */
defineProps<{ reviews: Review[]; coreSystem?: string; module?: string }>()
</script>

<template>
  <p v-if="!reviews.length" class="px-4 py-3 text-sm text-muted" data-testid="no-reviews">No review yet.</p>
  <ul v-else class="divide-y divide-slate-100" data-testid="reviews">
    <li v-for="r in reviews" :key="r.id ?? r.createdAt ?? ''" class="px-4 py-3 text-sm" data-testid="review">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="TONE_CLASS[r.outcome === 'APPROVED' ? 'success' : 'warning']"
          data-testid="review-outcome"
          >{{
            r.outcome === 'APPROVED' ? statusInfo('APPROVED').label : statusInfo('CHANGES_RECOMMENDED').label
          }}</span
        >
        <span class="text-muted"
          >{{ r.reviewer }}<template v-if="r.createdAt"> · {{ whenText(r.createdAt) }}</template></span
        >
      </div>
      <p v-if="r.comment" class="mt-2 whitespace-pre-line" data-testid="review-comment">{{ r.comment }}</p>
      <ol
        v-if="r.recommendations.length"
        class="mt-2 list-decimal space-y-1 pl-5"
        data-testid="recommendations"
      >
        <li v-for="rec in r.recommendations" :key="rec.id" data-testid="recommendation">
          {{ rec.text }}
          <span
            v-if="rec.appliedInVersionId !== null"
            class="ml-1 text-xs text-success"
            data-testid="applied-in"
          >
            applied in
            <RouterLink
              :to="`/cbs-queries/versions/${rec.appliedInVersionId}`"
              class="text-primary-1 underline"
              >version #{{ rec.appliedInVersionId }}</RouterLink
            >
          </span>
          <span
            v-else-if="r.outcome === 'CHANGES_RECOMMENDED'"
            class="ml-1 text-xs text-muted"
            data-testid="open-rec"
            >open</span
          >
        </li>
      </ol>
    </li>
  </ul>
</template>
