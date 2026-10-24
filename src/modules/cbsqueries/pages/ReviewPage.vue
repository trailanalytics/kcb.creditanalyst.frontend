<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { swalConfirm, toast } from '@/utils/dialogs'
import { cbsApi } from '../api'
import ExpectedColumns from '../components/ExpectedColumns.vue'
import FindingsTable from '../components/FindingsTable.vue'
import ReviewsList from '../components/ReviewsList.vue'
import SqlEditor from '../components/SqlEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'
import StatusBanner from '../components/StatusBanner.vue'
import StoredResult from '../components/StoredResult.vue'
import { showApiError } from '../feedback'
import { versionTitle } from '../statusModel'
import type { ReviewOutcome } from '../types'
import { useVersionDetail } from '../useVersionDetail'

/**
 * The analyst's page: the SQL read only, the module with its expected columns, the latest findings, earlier reviews (with
 * the version that applied each recommendation) and the review form. The form is only there while the server's `canReview`
 * flag is set; a 409 (for example the reviewer submitted the version) is shown as the server worded it.
 */
const props = defineProps<{ id: string }>()
const router = useRouter()
const versionId = computed(() => Number(props.id))
const { version, loading, error, reload } = useVersionDetail(versionId)

const outcome = ref<ReviewOutcome | ''>('')
const comment = ref('')
const lines = ref<string[]>([''])
const formError = ref<string | null>(null)
const busy = ref(false)

const sql = computed(() => version.value?.sql ?? '')
const recommending = computed(() => outcome.value === 'CHANGES_RECOMMENDED')
const filled = computed(() => lines.value.map((l) => l.trim()).filter(Boolean))

function addLine() {
  lines.value.push('')
}
function removeLine(i: number) {
  lines.value.splice(i, 1)
  if (!lines.value.length) lines.value.push('')
}

/** The message for a form that cannot be sent yet, or null. */
function problem(): string | null {
  if (!outcome.value) return 'Choose an outcome: approve the query or recommend changes.'
  if (recommending.value && filled.value.length === 0)
    return 'Add at least one recommendation for the changes.'
  return null
}

async function send() {
  const v = version.value
  formError.value = problem()
  if (formError.value || !v || !outcome.value) return
  if (outcome.value === 'APPROVED') {
    const answer = await swalConfirm.fire({
      icon: 'question',
      html: 'Approving stays valid for exactly this text. The Database Administrator can then activate it. Approve this query?',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve',
      reverseButtons: true,
    })
    if (!answer.isConfirmed) return
  }
  busy.value = true
  try {
    await cbsApi.review(v.id, {
      outcome: outcome.value,
      comment: comment.value.trim(),
      recommendations: recommending.value ? filled.value : [],
    })
    toast.success(outcome.value === 'APPROVED' ? 'Query approved.' : 'Changes recommended.')
    await router.push(`/cbs-queries/versions/${v.id}`)
  } catch (e) {
    await showApiError(e, 'The review could not be saved. Please try again.')
    await reload()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="px-2">
    <nav class="mb-3 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/cbs-queries" class="text-primary-1">CBS Query Configuration</RouterLink> /
      <span class="text-ink">Review {{ version ? versionTitle(version) : '' }}</span>
    </nav>

    <p v-if="error" class="card px-4 py-3 text-sm text-danger" data-testid="load-error">{{ error }}</p>
    <p v-else-if="loading && !version" class="py-6 text-center text-sm text-muted">loading…</p>

    <template v-else-if="version">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold text-project" data-testid="title">
          Review: {{ version.moduleInfo.name }}, {{ version.coreSystem }} version {{ version.versionNo }}
        </h2>
        <StatusBadge :status="version.status" />
        <RouterLink :to="`/cbs-queries/versions/${version.id}`" class="ml-auto text-sm text-primary-1"
          >Version details</RouterLink
        >
      </div>
      <StatusBanner :status="version.status" />

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-4">
          <SqlEditor :model-value="sql" readonly :rows="20" label="SQL under review" />

          <div class="card" data-testid="latest-findings">
            <header class="border-b border-slate-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-project">Latest validation</h3>
            </header>
            <template v-if="version.latestValidation">
              <div class="px-4 py-3"><StoredResult :result="version.latestValidation" /></div>
              <FindingsTable :findings="version.latestValidation.findings" empty="No findings." />
            </template>
            <p v-else class="px-4 py-3 text-sm text-muted">This version has not been validated yet.</p>
          </div>

          <div class="card" data-testid="history">
            <header class="border-b border-slate-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-project">Reviews so far</h3>
            </header>
            <ReviewsList :reviews="version.reviews" />
          </div>

          <form v-if="version.canReview" class="card" data-testid="review-form" @submit.prevent="send">
            <header class="border-b border-slate-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-project">Your review</h3>
            </header>
            <div class="space-y-4 px-4 py-4 text-sm">
              <fieldset>
                <legend class="mb-1 text-slate-600">Outcome</legend>
                <label class="mr-6 inline-flex items-center gap-2">
                  <input
                    v-model="outcome"
                    type="radio"
                    name="outcome"
                    value="APPROVED"
                    data-testid="outcome-approved"
                  />
                  Approve
                </label>
                <label class="inline-flex items-center gap-2">
                  <input
                    v-model="outcome"
                    type="radio"
                    name="outcome"
                    value="CHANGES_RECOMMENDED"
                    data-testid="outcome-changes"
                  />
                  Recommend changes
                </label>
              </fieldset>
              <label class="block">
                <span class="mb-1 block text-slate-600">Comment</span>
                <textarea v-model="comment" rows="3" class="form-input" data-testid="comment"></textarea>
              </label>
              <fieldset v-if="recommending" data-testid="recommendation-lines">
                <legend class="mb-1 text-slate-600">Recommendations for the Database Administrator</legend>
                <div v-for="(_, i) in lines" :key="i" class="mb-2 flex gap-2">
                  <input
                    v-model="lines[i]"
                    type="text"
                    class="form-input"
                    :aria-label="`Recommendation ${i + 1}`"
                    placeholder="What should change"
                    data-testid="recommendation-input"
                  />
                  <button
                    type="button"
                    class="btn-outline !px-3"
                    :aria-label="`Remove recommendation ${i + 1}`"
                    @click="removeLine(i)"
                  >
                    Remove
                  </button>
                </div>
                <button
                  type="button"
                  class="btn-outline !px-3 !py-1 text-xs"
                  data-testid="add-recommendation"
                  @click="addLine"
                >
                  Add recommendation
                </button>
              </fieldset>
              <p v-if="formError" class="text-danger" role="alert" data-testid="form-error">
                {{ formError }}
              </p>
              <button type="submit" class="btn-primary-1" :disabled="busy" data-testid="send-review">
                Save review
              </button>
            </div>
          </form>
          <p v-else class="card px-4 py-3 text-sm text-muted" data-testid="cannot-review">
            You cannot review this version now: only a validated version can be reviewed, and not by the
            person who created or submitted it.
          </p>
        </div>

        <ExpectedColumns
          :columns="version.moduleInfo.columns"
          :findings="version.latestValidation?.findings ?? null"
          :bind-count="version.moduleInfo.bindCount"
        />
      </div>
    </template>
  </section>
</template>
