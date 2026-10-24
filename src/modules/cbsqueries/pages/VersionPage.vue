<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { swalConfirm, swalDelete, toast } from '@/utils/dialogs'
import { cbsApi } from '../api'
import EventsTable from '../components/EventsTable.vue'
import FindingsTable from '../components/FindingsTable.vue'
import ReviewsList from '../components/ReviewsList.vue'
import SqlEditor from '../components/SqlEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'
import StatusBanner from '../components/StatusBanner.vue'
import StoredResult from '../components/StoredResult.vue'
import { showApiError } from '../feedback'
import { availableActions, dateText, versionTitle, whenText } from '../statusModel'
import { useCbsAccess } from '../useCbsAccess'
import { useVersionDetail } from '../useVersionDetail'

/**
 * One version: status, SQL, validation (latest result and the submissions so far), reviews with their recommendations, the audit
 * trail, and the buttons the caller may use: edit, submit, review, revise, activate, promote to sample, remove sample.
 */
const props = defineProps<{ id: string }>()
const router = useRouter()
const { canManage } = useCbsAccess()
const versionId = computed(() => Number(props.id))
const { version, loading, error, reload } = useVersionDetail(versionId)
const busy = ref(false)

const actions = computed(() => (version.value ? availableActions(version.value, canManage.value) : null))
const submissions = computed(() =>
  (version.value?.events ?? []).filter((e) => e.event === 'SUBMITTED' || e.event === 'VALIDATED'),
)
const anyAction = computed(() => (actions.value ? Object.values(actions.value).some(Boolean) : false))

/** Confirm (when asked), call, then show the new state. */
async function run(
  question: { html: string; button: string; danger?: boolean } | null,
  call: () => Promise<unknown>,
  done: string,
  after?: (result: unknown) => Promise<void> | void,
) {
  if (question) {
    const dialog = question.danger ? swalDelete : swalConfirm
    const answer = await dialog.fire({
      icon: 'question',
      html: question.html,
      showCancelButton: true,
      confirmButtonText: question.button,
      reverseButtons: true,
    })
    if (!answer.isConfirmed) return
  }
  busy.value = true
  try {
    const result = await call()
    toast.success(done)
    if (after) await after(result)
    else await reload()
  } catch (e) {
    await showApiError(e)
    await reload()
  } finally {
    busy.value = false
  }
}

const submit = () =>
  run(
    {
      html: 'Submit this version for validation? The text cannot be edited after it is submitted.',
      button: 'Yes, submit',
    },
    () => cbsApi.submit(versionId.value),
    'Submitted.',
  )
const revise = () =>
  run(
    { html: 'Create a new draft from this version to apply the recommendations?', button: 'Yes, revise' },
    () => cbsApi.revise(versionId.value),
    'New draft created.',
    (draft) =>
      router.push(`/cbs-queries/versions/${(draft as { id: number }).id}/edit`).then(() => undefined),
  )
const activate = () =>
  run(
    {
      html: 'Activate this version? The extractors read it from the next run, and the current active version becomes superseded.',
      button: 'Yes, activate',
    },
    () => cbsApi.activate(versionId.value),
    'Version activated.',
  )
const promote = () =>
  run(
    {
      html: 'Promote this version to a sample? It becomes a starting point for drafts.',
      button: 'Yes, promote',
    },
    () => cbsApi.promoteSample(versionId.value),
    'Promoted to sample.',
  )
const removeSample = () =>
  run(
    { html: 'Remove this version from the sample library?', button: 'Yes, remove', danger: true },
    () => cbsApi.removeSample(versionId.value),
    'Removed from the samples.',
  )
</script>

<template>
  <section class="px-2">
    <nav class="mb-3 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/cbs-queries" class="text-primary-1">CBS Query Configuration</RouterLink> /
      <span class="text-ink">{{ version ? versionTitle(version) : 'Version' }}</span>
    </nav>

    <p v-if="error" class="card px-4 py-3 text-sm text-danger" data-testid="load-error">{{ error }}</p>
    <p v-else-if="loading && !version" class="py-6 text-center text-sm text-muted">loading…</p>

    <template v-else-if="version && actions">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold text-project" data-testid="title">
          {{ version.moduleInfo.name }}, {{ version.coreSystem }} version {{ version.versionNo }}
        </h2>
        <StatusBadge :status="version.status" />
        <span
          v-if="version.isSample"
          class="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
          data-testid="sample-badge"
          >Sample</span
        >
      </div>
      <StatusBanner :status="version.status" />

      <div class="card mb-4 px-4 py-3 text-sm" data-testid="facts">
        <dl class="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt class="mr-1 inline text-muted">Created</dt>
            <dd class="inline">{{ version.createdBy }}, {{ whenText(version.createdAt) }}</dd>
          </div>
          <div v-if="version.submittedAt">
            <dt class="mr-1 inline text-muted">Submitted</dt>
            <dd class="inline">{{ version.submittedBy }}, {{ whenText(version.submittedAt) }}</dd>
          </div>
          <div v-if="version.activatedAt">
            <dt class="mr-1 inline text-muted">Activated</dt>
            <dd class="inline">{{ version.activatedBy }}, {{ dateText(version.activatedAt) }}</dd>
          </div>
          <div v-if="version.parentVersionId !== null">
            <dt class="mr-1 inline text-muted">Based on</dt>
            <dd class="inline">
              <RouterLink :to="`/cbs-queries/versions/${version.parentVersionId}`" class="text-primary-1"
                >version #{{ version.parentVersionId }}</RouterLink
              >
            </dd>
          </div>
          <div v-if="version.note" class="sm:col-span-2">
            <dt class="mr-1 inline text-muted">Note</dt>
            <dd class="inline">{{ version.note }}</dd>
          </div>
        </dl>
      </div>

      <div v-if="anyAction" class="mb-4 flex flex-wrap gap-3" data-testid="actions">
        <RouterLink
          v-if="actions.edit"
          :to="`/cbs-queries/versions/${version.id}/edit`"
          class="btn-primary-1"
          data-testid="edit"
          >Edit</RouterLink
        >
        <button
          v-if="actions.submit"
          type="button"
          class="btn-primary-1"
          :disabled="busy"
          data-testid="submit"
          @click="submit"
        >
          Submit
        </button>
        <RouterLink
          v-if="actions.review"
          :to="`/cbs-queries/versions/${version.id}/review`"
          class="btn-primary-1"
          data-testid="review"
          >Review</RouterLink
        >
        <button
          v-if="actions.revise"
          type="button"
          class="btn-primary-1"
          :disabled="busy"
          data-testid="revise"
          @click="revise"
        >
          Revise (new draft)
        </button>
        <button
          v-if="actions.activate"
          type="button"
          class="btn-primary-1"
          :disabled="busy"
          data-testid="activate"
          @click="activate"
        >
          Activate
        </button>
        <button
          v-if="actions.promoteSample"
          type="button"
          class="btn-outline"
          :disabled="busy"
          data-testid="promote"
          @click="promote"
        >
          Promote to sample
        </button>
        <button
          v-if="actions.removeSample"
          type="button"
          class="btn-outline"
          :disabled="busy"
          data-testid="remove-sample"
          @click="removeSample"
        >
          Remove sample
        </button>
      </div>

      <div class="space-y-4">
        <div class="card">
          <header class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-semibold text-project">SQL</h3>
          </header>
          <div class="p-3"><SqlEditor :model-value="version.sql" readonly :rows="16" label="SQL" /></div>
        </div>

        <div class="card" data-testid="validation">
          <header class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-semibold text-project">Validation</h3>
          </header>
          <template v-if="version.latestValidation">
            <div class="px-4 py-3"><StoredResult :result="version.latestValidation" /></div>
            <FindingsTable :findings="version.latestValidation.findings" empty="No findings." />
          </template>
          <p v-else class="px-4 py-3 text-sm text-muted" data-testid="not-validated">
            Not submitted for validation yet.
          </p>
          <div
            v-if="submissions.length"
            class="border-t border-slate-100 px-4 py-3 text-sm"
            data-testid="validation-history"
          >
            <h4 class="mb-1 text-xs font-semibold uppercase text-slate-500">Submissions</h4>
            <ul class="space-y-1">
              <li v-for="(s, i) in submissions" :key="s.id ?? i">
                {{ whenText(s.createdAt) }}: {{ s.event === 'SUBMITTED' ? 'submitted' : 'validated'
                }}<template v-if="s.actor"> by {{ s.actor }}</template
                ><template v-if="s.detail"> ({{ s.detail }})</template>
              </li>
            </ul>
          </div>
        </div>

        <div class="card" data-testid="reviews-card">
          <header class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-semibold text-project">Reviews and recommendations</h3>
          </header>
          <ReviewsList :reviews="version.reviews" />
        </div>

        <div class="card" data-testid="audit">
          <header class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-semibold text-project">Audit trail</h3>
          </header>
          <EventsTable :events="version.events" />
          <p v-if="!version.events.length" class="px-4 py-3 text-sm text-muted">No events yet.</p>
        </div>
      </div>
    </template>
  </section>
</template>
