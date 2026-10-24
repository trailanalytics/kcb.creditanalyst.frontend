<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { swalConfirm, toast } from '@/utils/dialogs'
import { cbsApi } from '../api'
import ExpectedColumns from '../components/ExpectedColumns.vue'
import FindingsTable from '../components/FindingsTable.vue'
import SqlEditor from '../components/SqlEditor.vue'
import StatusBadge from '../components/StatusBadge.vue'
import StatusBanner from '../components/StatusBanner.vue'
import StoredResult from '../components/StoredResult.vue'
import { showApiError } from '../feedback'
import { applySuggestion } from '../suggestion'
import { versionTitle } from '../statusModel'
import type { Finding } from '../types'
import { useLiveValidation } from '../useLiveValidation'
import { useVersionDetail } from '../useVersionDetail'

/**
 * The DBA's editor: the SQL with line numbers, the expected columns with a tick for each one the query produces, a live check
 * 800 ms after typing (POST /validate, nothing stored), the findings with "Apply suggestion", Save draft and Submit. What the
 * buttons offer follows the version's can* flags; after a submit the stored result is shown.
 */
const props = defineProps<{ id: string }>()
const versionId = computed(() => Number(props.id))
const { version, loading, error, reload } = useVersionDetail(versionId)

const sql = ref('')
const note = ref('')
const baseline = ref({ sql: '', note: '' })
const editor = ref<InstanceType<typeof SqlEditor> | null>(null)
const busy = ref<'save' | 'submit' | null>(null)

const module = computed(() => version.value?.moduleInfo.code ?? '')
const live = useLiveValidation(module, sql)
const canEdit = computed(() => version.value?.canEdit ?? false)
const dirty = computed(() => sql.value !== baseline.value.sql || note.value !== baseline.value.note)

// a freshly loaded version (first load, after a save or a submit) replaces what is in the box
watch(version, (v) => {
  if (!v) return
  sql.value = v.sql
  note.value = v.note ?? ''
  baseline.value = { sql: v.sql, note: v.note ?? '' }
  if (v.canEdit) void live.validateNow()
})

const findings = computed<Finding[]>(() =>
  canEdit.value ? (live.outcome.value?.findings ?? []) : (version.value?.latestValidation?.findings ?? []),
)
const columnFindings = computed<Finding[] | null>(() =>
  canEdit.value
    ? (live.outcome.value?.findings ?? null)
    : (version.value?.latestValidation?.findings ?? null),
)

function apply(f: Finding) {
  const result = applySuggestion(sql.value, f)
  if (!result) {
    toast.warning('That suggestion no longer fits the text. It will update when the check has run again.')
    return
  }
  sql.value = result.sql
  void nextTick(() => editor.value?.focusAt(result.caret))
  void live.validateNow()
}

async function save(): Promise<boolean> {
  if (!version.value) return false
  busy.value = 'save'
  try {
    await cbsApi.save(version.value.id, { sql: sql.value, note: note.value })
    await reload()
    return true
  } catch (e) {
    await showApiError(e, 'The draft could not be saved. Please try again.')
    return false
  } finally {
    busy.value = null
  }
}

async function saveDraft() {
  if (await save()) toast.success('Draft saved.')
}

async function submit() {
  const v = version.value
  if (!v) return
  const errors = live.outcome.value && !live.stale.value ? live.outcome.value.errorCount : 0
  if (errors > 0) {
    const answer = await swalConfirm.fire({
      icon: 'warning',
      title: 'Submit with errors?',
      html: `The check found ${errors} error${errors === 1 ? '' : 's'}. The version will be stored as validation failed, and you can edit and submit it again.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, submit',
      reverseButtons: true,
    })
    if (!answer.isConfirmed) return
  }
  if (dirty.value && !(await save())) return
  busy.value = 'submit'
  try {
    const stored = await cbsApi.submit(v.id)
    await reload()
    const passed = stored.latestValidation?.passed ?? version.value?.status === 'VALIDATED'
    if (passed) toast.success('Submitted. The query passed validation and waits for review.')
    else toast.warning('Submitted. The query failed validation: see the stored result.')
  } catch (e) {
    await showApiError(e, 'The query could not be submitted. Please try again.')
  } finally {
    busy.value = null
  }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value || !canEdit.value) return true
  const answer = await swalConfirm.fire({
    icon: 'warning',
    html: 'You have unsaved changes. Leave this page and lose them?',
    showCancelButton: true,
    confirmButtonText: 'Leave',
    reverseButtons: true,
  })
  return answer.isConfirmed
})
</script>

<template>
  <section class="px-2">
    <nav class="mb-3 text-sm text-muted">
      <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
      <RouterLink to="/cbs-queries" class="text-primary-1">CBS Query Configuration</RouterLink> /
      <span class="text-ink">{{ version ? versionTitle(version) : 'Edit' }}</span>
    </nav>

    <p v-if="error" class="card px-4 py-3 text-sm text-danger" data-testid="load-error">{{ error }}</p>
    <p v-else-if="loading && !version" class="py-6 text-center text-sm text-muted">loading…</p>

    <template v-else-if="version">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold text-project" data-testid="title">
          {{ version.moduleInfo.name }}, {{ version.coreSystem }} version {{ version.versionNo }}
        </h2>
        <StatusBadge :status="version.status" />
        <RouterLink
          :to="`/cbs-queries/versions/${version.id}`"
          class="ml-auto text-sm text-primary-1"
          data-testid="details-link"
          >Version details</RouterLink
        >
      </div>
      <StatusBanner :status="version.status" />

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-4">
          <SqlEditor ref="editor" v-model="sql" :readonly="!canEdit" :rows="16" label="SQL" />
          <label class="block text-sm">
            <span class="mb-1 block text-slate-600">Note</span>
            <input
              v-model="note"
              type="text"
              class="form-input"
              :readonly="!canEdit"
              maxlength="500"
              data-testid="note"
            />
          </label>
          <div class="flex flex-wrap items-center gap-3">
            <button
              v-if="version.canEdit"
              type="button"
              class="btn-outline"
              :disabled="!dirty || busy !== null"
              data-testid="save"
              @click="saveDraft"
            >
              Save draft
            </button>
            <button
              v-if="version.canSubmit"
              type="button"
              class="btn-primary-1"
              :disabled="busy !== null"
              data-testid="submit"
              @click="submit"
            >
              Submit
            </button>
            <span v-if="dirty && canEdit" class="text-xs text-muted" data-testid="unsaved"
              >Unsaved changes</span
            >
            <span v-if="canEdit && live.checking.value" class="text-xs text-muted" data-testid="checking"
              >checking…</span
            >
          </div>

          <div class="card" data-testid="live-check">
            <header class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-project">
                {{ canEdit ? 'Live check' : 'Latest check' }}
              </h3>
              <template v-if="canEdit && live.outcome.value">
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="
                    live.outcome.value.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  "
                  data-testid="live-passed"
                  >{{ live.outcome.value.passed ? 'Passes' : 'Does not pass' }}</span
                >
                <span class="text-xs text-muted" data-testid="live-counts"
                  >{{ live.outcome.value.errorCount }} errors,
                  {{ live.outcome.value.warningCount }} warnings</span
                >
                <span v-if="live.stale.value" class="text-xs text-muted">(older than the text)</span>
              </template>
            </header>
            <p
              v-if="canEdit && live.failed.value"
              class="px-4 py-3 text-sm text-danger"
              data-testid="live-failed"
            >
              The check is not available right now. You can still save and submit.
            </p>
            <p v-else-if="canEdit && !live.outcome.value" class="px-4 py-3 text-sm text-muted">Checking…</p>
            <FindingsTable
              v-else
              :findings="findings"
              :applicable="canEdit && !live.stale.value"
              :show-apply="canEdit"
              empty="No findings: every expected column is aliased."
              @apply="apply"
            />
          </div>

          <div v-if="version.latestValidation" class="card" data-testid="stored-check">
            <header class="border-b border-slate-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-project">Stored result of the last submission</h3>
            </header>
            <div class="px-4 py-3"><StoredResult :result="version.latestValidation" /></div>
            <FindingsTable
              :findings="version.latestValidation.findings"
              empty="The stored result has no findings."
            />
          </div>
        </div>

        <ExpectedColumns
          :columns="version.moduleInfo.columns"
          :findings="columnFindings"
          :bind-count="version.moduleInfo.bindCount"
        />
      </div>
    </template>
  </section>
</template>
