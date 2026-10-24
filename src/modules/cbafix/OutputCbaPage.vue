<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { hideLoader, showLoader, swalConfirm, swalDelete, swalNotification, toast } from '@/utils/dialogs'
import { cbaFixApi } from './api'
import CbaGrid from './components/CbaGrid.vue'
import ColumnChooser from './components/ColumnChooser.vue'
import DownloadCbaDialog from './components/DownloadCbaDialog.vue'
import ValidationPanel from './components/ValidationPanel.vue'
import {
  buildSave,
  DSM_URL,
  editedCount,
  failureText,
  invalidNumberCells,
  lastPage,
  markSaved,
  PAGE_SIZES,
  REFERENCE,
  saveSummary,
  toRow,
  type GridRow,
} from './gridModel'
import type { CbaColumn, Validations } from './types'

/**
 * /cba/output: the modify-accounts grid over the working table of the CBA report (OutputCbaTable.vue). Cells are edited in place and
 * saved by column name; the validation rules, their automatic fixes and "Download Short CBA" sit beside it.
 */
const router = useRouter()

const columns = ref<CbaColumn[]>([])
const visible = ref<boolean[]>([])
const rows = ref<GridRow[]>([])
const page = ref(0)
const lastPageNumber = ref(1)
const total = ref(0)
const perPage = ref<number>(10)

const searchText = ref('')
const appliedSearch = ref('')
const rule = ref('')

const validations = ref<Validations | null>(null)
const validationsLoading = ref(false)
const validationsFailed = ref(false)

const saving = ref(false)
const autoSaving = ref(false)
const working = ref(false)
const downloadOpen = ref(false)

let cleared: { row: number; col: number; value: string } | null = null
let timer: ReturnType<typeof setInterval> | undefined

const edited = computed(() => editedCount(rows.value))
const empty = computed(() => rows.value.length === 0)
const hasPrevious = computed(() => page.value > 1 && !empty.value)
const status = computed(() =>
  total.value === 0
    ? ''
    : `Page ${page.value} of ${lastPageNumber.value} · ${total.value} account${total.value === 1 ? '' : 's'}`,
)

// ---- loading ----

/** Unsaved edits are written before the rows are replaced, so a page change never loses them. False when that failed. */
async function settle(): Promise<boolean> {
  return edited.value === 0 || (await save(false))
}

async function load(target: number, message = 'CBA data loaded successfully.'): Promise<boolean> {
  if (!(await settle())) return false
  showLoader('loading...')
  try {
    const result = await cbaFixApi.list({
      page: target,
      per_page: perPage.value,
      search: appliedSearch.value,
      rule: rule.value,
    })
    rows.value = result.data.map(toRow)
    page.value = result.current_page
    lastPageNumber.value = result.last_page
    total.value = result.total
    cleared = null
    if (message) toast.success(message)
    return true
  } catch (e) {
    toast.error(failureText(e, 'Failed to load CBA data. Please try again.'))
    return false
  } finally {
    hideLoader()
  }
}

async function loadValidations() {
  validationsLoading.value = true
  validationsFailed.value = false
  try {
    validations.value = await cbaFixApi.validations()
  } catch {
    validationsFailed.value = true
    toast.error('Failed to load validation rules. Please try again.')
  } finally {
    validationsLoading.value = false
  }
}

async function loadMore() {
  if (empty.value) {
    await load(1)
  } else if (lastPage({ current_page: page.value, last_page: lastPageNumber.value })) {
    toast.info('There are no more accounts to load.')
  } else {
    await load(page.value + 1)
  }
}

async function loadPrevious() {
  await load(Math.max(page.value - 1, 1), 'Previous CBA data loaded successfully.')
}

async function loadAccount() {
  const text = searchText.value.trim()
  if (!text && !rule.value) {
    toast.error('Please enter an account reference or client number of the loan.')
    return
  }
  const before = appliedSearch.value
  appliedSearch.value = text
  const ok = await load(1, '')
  if (!ok) {
    appliedSearch.value = before
    return
  }
  if (total.value === 0) toast.error('No data found for the account number.')
  else toast.success('CBA data loaded successfully.')
}

async function changePageSize() {
  await load(1)
}

function clearAll() {
  rows.value = []
  page.value = 0
  lastPageNumber.value = 1
  total.value = 0
  appliedSearch.value = ''
  rule.value = ''
  cleared = null
}

async function showRule(name: string) {
  const before = rule.value
  rule.value = name
  if (!(await load(1, ''))) rule.value = before
  else if (total.value === 0) toast.info(`No accounts break ${name} any more.`)
  else toast.success(`Showing the accounts that break ${name}.`)
}

async function clearRule() {
  rule.value = ''
  await load(1, '')
}

// ---- editing ----

function onEdit(r: number, c: number, value: string) {
  const row = rows.value[r]
  const column = columns.value[c]
  if (!row || !column) return
  row.values[c] = value
  if (column.numeric && value.trim() !== '' && Number.isNaN(Number(value)))
    toast.error('Invalid input. Please enter digits only.')
}

function onClear(r: number, c: number) {
  const row = rows.value[r]
  if (!row || (row.values[c] ?? '') === '') return
  cleared = { row: r, col: c, value: row.values[c] ?? '' }
  row.values[c] = ''
}

function onRestore(r: number, c: number) {
  const row = rows.value[r]
  if (!row || !cleared || cleared.row !== r || cleared.col !== c || cleared.value === '') return
  row.values[c] = cleared.value
}

function onHide(r: number) {
  rows.value.splice(r, 1)
}

async function onRemove(r: number) {
  const row = rows.value[r]
  const refCol = columns.value.findIndex((c) => c.key === REFERENCE)
  const reference = row?.values[refCol]?.trim()
  if (!row || !reference) return
  const answer = await swalDelete.fire({
    title: 'Are you sure?',
    html: `You are about to remove account reference: <b>${escapeHtml(reference)}</b> from CBA. The loan account is closed as fully paid and deleted as well. This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, remove it!',
    cancelButtonText: 'No, cancel!',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return
  showLoader('Removing account from CBA...')
  try {
    await cbaFixApi.remove(reference)
    rows.value = rows.value.filter((x) => x.id !== row.id)
    total.value = Math.max(0, total.value - 1)
    toast.success('Account removed from CBA successfully.')
    void loadValidations()
  } catch (e) {
    toast.error(failureText(e, 'Failed to remove account from CBA. Please try again.'))
  } finally {
    hideLoader()
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

// ---- saving ----

/** Sends the edited cells only, by column name. `loud` is false for the silent save every 60 seconds and before a page change. */
async function save(loud = true): Promise<boolean> {
  if (saving.value) return false
  if (empty.value) {
    if (loud) toast.info('There is no data to save!')
    return false
  }
  if (edited.value === 0) {
    if (loud) toast.info('There are no changes to save.')
    return true
  }
  if (invalidNumberCells(rows.value, columns.value).length > 0) {
    toast.error('Some edited cells need a number. Correct the cells outlined in red, then save.')
    return false
  }
  saving.value = true
  try {
    const result = await cbaFixApi.save(buildSave(rows.value, columns.value))
    markSaved(rows.value, columns.value, result.unmatched)
    const summary = saveSummary(result)
    if (summary.warning) toast.warning(summary.text)
    else if (loud) toast.success(summary.text)
    void loadValidations()
    return !summary.warning
  } catch (e) {
    toast.error(failureText(e, 'Failed to save changes. Please try again.'))
    return false
  } finally {
    saving.value = false
  }
}

async function autoSave() {
  if (edited.value === 0 || saving.value || working.value) return
  autoSaving.value = true
  try {
    await save(false)
  } finally {
    autoSaving.value = false
  }
}

function onKey(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (edited.value > 0) event.preventDefault()
}

// ---- fixes ----

async function fix(name: string) {
  const entry = validations.value?.validations[name]
  const answer = await swalConfirm.fire({
    icon: 'question',
    title: `Fix ${name}?`,
    html: `${entry ? `${entry.desc}<br>` : ''}The automatic fix changes ${entry ? entry.count : 'the'} record(s) of the CBA report.`,
    showCancelButton: true,
    confirmButtonText: 'Fix',
    reverseButtons: true,
  })
  if (!answer.isConfirmed || !(await settle())) return
  await runFix('Fixing validation error...', () => cbaFixApi.fix(name))
}

async function fixAll() {
  const answer = await swalConfirm.fire({
    icon: 'question',
    title: 'Fix all?',
    text: 'Every automatic fix runs in the recommended order, all or none. Rules that need a person are left for you.',
    showCancelButton: true,
    confirmButtonText: 'Fix all',
    reverseButtons: true,
  })
  if (!answer.isConfirmed || !(await settle())) return
  await runFix('Fixing validation errors...', () => cbaFixApi.fixAll())
}

async function runFix(loader: string, call: () => Promise<{ message: string; updated: number }>) {
  working.value = true
  showLoader(loader)
  try {
    const result = await call()
    hideLoader()
    if (result.updated === 0) toast.info(result.message)
    else toast.success(result.message)
    await Promise.all([load(page.value || 1, 'CBA data refreshed successfully.'), loadValidations()])
  } catch (e) {
    hideLoader()
    toast.error(failureText(e, 'Failed to fix validation error. Please try again.'))
  } finally {
    working.value = false
  }
}

// ---- download ----

async function download(toDate: string, version: '7.0' | '8.0') {
  if (!(await settle())) return
  working.value = true
  showLoader('Queuing the CBA download...')
  try {
    await cbaFixApi.download(toDate, version)
    hideLoader()
    downloadOpen.value = false
    await router.push('/background-processes')
  } catch (e) {
    hideLoader()
    await swalNotification(
      'error',
      failureText(e, 'The CBA download could not be started. Please try again.'),
    )
  } finally {
    working.value = false
  }
}

function openDsm() {
  window.open(DSM_URL, '_blank', 'location=yes,height=570,width=520,scrollbars=yes,status=yes')
}

// ---- lifecycle ----

onBeforeRouteLeave(async () => {
  if (edited.value === 0) return true
  const answer = await swalConfirm.fire({
    icon: 'warning',
    title: 'Unsaved changes',
    text: 'Some edited cells are not saved. Leave without saving them?',
    showCancelButton: true,
    confirmButtonText: 'Leave',
    cancelButtonText: 'Stay',
    reverseButtons: true,
  })
  return answer.isConfirmed
})

onMounted(async () => {
  try {
    columns.value = await cbaFixApi.columns()
    visible.value = columns.value.map(() => true)
  } catch (e) {
    toast.error(failureText(e, 'Failed to load CBA data. Please try again.'))
    return
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
  timer = setInterval(() => void autoSave(), 60_000)
  await Promise.all([load(1), loadValidations()])
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="pb-8">
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-9">
        <CbaGrid
          :columns="columns"
          :rows="rows"
          :visible="visible"
          :rule="rule"
          @edit="onEdit"
          @clear="onClear"
          @restore="onRestore"
          @hide-row="onHide"
          @remove-row="onRemove"
        />

        <p v-if="rule" class="mt-2 text-sm text-slate-600" data-testid="rule-note">
          Showing the accounts that break <b>{{ rule }}</b
          >; the highlighted cells are the ones the rule looks at.
        </p>

        <div class="mt-3 flex flex-wrap items-center justify-end gap-2" data-testid="toolbar">
          <span v-if="status" class="mr-auto text-sm text-slate-500" data-testid="page-status">{{
            status
          }}</span>
          <label class="flex items-center gap-1 text-sm text-slate-600">
            Rows per page
            <select
              v-model.number="perPage"
              class="form-input w-auto py-1"
              aria-label="Rows per page"
              :disabled="saving"
              @change="changePageSize"
            >
              <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <input
            v-model="searchText"
            type="text"
            class="form-input w-80"
            placeholder="Enter Account Reference or Client Number"
            @keydown.enter="loadAccount"
          />
          <button
            type="button"
            class="rounded bg-success px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            :disabled="saving"
            @click="loadAccount"
          >
            Load Account
          </button>
          <button
            type="button"
            class="rounded bg-danger px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            :disabled="saving"
            @click="clearAll"
          >
            Clear All
          </button>
          <button
            v-if="hasPrevious"
            type="button"
            class="btn-primary-1"
            :disabled="saving"
            @click="loadPrevious"
          >
            Load Previous
          </button>
          <button type="button" class="btn-primary-1" :disabled="saving" @click="loadMore">
            {{ empty ? 'Load Accounts' : 'Load More' }}
          </button>
          <button type="button" class="btn-primary-1" :disabled="saving" @click="openDsm">
            Open DSM (v8.0)
          </button>
          <button
            type="button"
            class="btn-outline"
            :disabled="saving"
            data-testid="download-short"
            @click="downloadOpen = true"
          >
            Download Short CBA
          </button>
          <button
            type="button"
            class="rounded bg-success px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            :disabled="saving"
            data-testid="save"
            @click="save()"
          >
            Save Changes<span v-if="edited > 0" class="ml-1 text-xs">({{ edited }})</span>
          </button>
        </div>
      </div>

      <div class="space-y-4 lg:col-span-3">
        <ColumnChooser v-if="columns.length" v-model="visible" :columns="columns" />
        <ValidationPanel
          :data="validations"
          :loading="validationsLoading"
          :failed="validationsFailed"
          :active-rule="rule"
          :busy="working || saving"
          @view="showRule"
          @fix="fix"
          @fix-all="fixAll"
          @clear-rule="clearRule"
        />
      </div>
    </div>

    <div
      v-if="autoSaving"
      class="fixed bottom-4 right-4 z-40 w-64 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800"
      role="status"
    >
      saving...
    </div>

    <DownloadCbaDialog v-model:open="downloadOpen" :busy="working" @confirm="download" />
  </section>
</template>
