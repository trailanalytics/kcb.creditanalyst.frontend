<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { toast } from '@/utils/dialogs'
import { cbsApi } from '../api'
import CbsTabs from '../components/CbsTabs.vue'
import SqlEditor from '../components/SqlEditor.vue'
import { showApiError } from '../feedback'
import { dateText } from '../statusModel'
import type { CoreSystem, ModuleSummary, VersionSummary } from '../types'
import { useCbsAccess } from '../useCbsAccess'

/**
 * Samples: versions that were active at some point and so are known to work. Filter by core system and module; "Use as draft"
 * copies one into a new draft for the chosen target core system (a Finacle draft can start from the T24 sample as a reference).
 */
const route = useRoute()
const router = useRouter()
const { canManage } = useCbsAccess()

const coreSystems = ref<CoreSystem[]>([])
const modules = ref<ModuleSummary[]>([])
const coreSystem = ref('')
const moduleCode = ref(typeof route.query.module === 'string' ? route.query.module : '')
const target = ref('')
const samples = ref<VersionSummary[]>([])
const sqlOf = ref<Record<number, string>>({})
const open = ref<number | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<number | null>(null)

const configured = computed(
  () => coreSystems.value.find((c) => c.configured)?.code ?? coreSystems.value[0]?.code ?? '',
)
const moduleName = (code: string) => modules.value.find((m) => m.code === code)?.name ?? code

async function loadSamples() {
  loading.value = true
  error.value = null
  const asked = `${coreSystem.value}|${moduleCode.value}`
  try {
    const list = await cbsApi.samples({
      ...(coreSystem.value ? { coreSystem: coreSystem.value } : {}),
      ...(moduleCode.value ? { module: moduleCode.value } : {}),
    })
    if (asked === `${coreSystem.value}|${moduleCode.value}`) samples.value = list
  } catch (e) {
    error.value = messageOf(e, 'The samples could not be loaded. Please refresh and try again.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    ;[coreSystems.value, modules.value] = await Promise.all([cbsApi.coreSystems(), cbsApi.modules()])
  } catch (e) {
    error.value = messageOf(e, 'The samples could not be loaded. Please refresh and try again.')
    loading.value = false
    return
  }
  const asked = typeof route.query.coreSystem === 'string' ? route.query.coreSystem : ''
  coreSystem.value = coreSystems.value.some((c) => c.code === asked) ? asked : configured.value
  target.value = configured.value
  // a changed core system loads through the watcher below; with none to choose, load the unfiltered list here
  if (!coreSystem.value) await loadSamples()
})
watch([coreSystem, moduleCode], loadSamples)

/** Samples grouped by module, in the order of the module list. */
const groups = computed(() =>
  modules.value
    .map((m) => ({ module: m, samples: samples.value.filter((s) => s.module === m.code) }))
    .filter((g) => g.samples.length),
)

async function show(sample: VersionSummary) {
  if (open.value === sample.id) {
    open.value = null
    return
  }
  open.value = sample.id
  if (sqlOf.value[sample.id] !== undefined) return
  try {
    sqlOf.value[sample.id] = (await cbsApi.version(sample.id)).sql
  } catch (e) {
    open.value = null
    await showApiError(e, 'The SQL could not be loaded. Please try again.')
  }
}

async function useAsDraft(sample: VersionSummary) {
  busy.value = sample.id
  try {
    const draft = await cbsApi.createDraft({
      coreSystem: target.value || sample.coreSystem,
      module: sample.module,
      fromVersionId: sample.id,
    })
    toast.success(`Draft version ${draft.versionNo} created from the sample.`)
    await router.push(`/cbs-queries/versions/${draft.id}/edit`)
  } catch (e) {
    await showApiError(e, 'The draft could not be created. Please try again.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="px-2">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <nav class="text-sm text-muted">
        <RouterLink to="/home" class="text-primary-1">Home</RouterLink> /
        <RouterLink to="/cbs-queries" class="text-primary-1">CBS Query Configuration</RouterLink> /
        <span class="text-ink">Sample library</span>
      </nav>
      <div class="ml-auto flex flex-wrap items-center gap-3">
        <label class="flex">
          <span
            class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm whitespace-nowrap"
            >Core system</span
          >
          <select
            v-model="coreSystem"
            class="form-input rounded-l-none"
            aria-label="Core system"
            data-testid="core-system"
          >
            <option value="">All</option>
            <option v-for="c in coreSystems" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </label>
        <label class="flex">
          <span
            class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm whitespace-nowrap"
            >Module</span
          >
          <select
            v-model="moduleCode"
            class="form-input rounded-l-none"
            aria-label="Module"
            data-testid="module"
          >
            <option value="">All</option>
            <option v-for="m in modules" :key="m.code" :value="m.code">{{ m.name }}</option>
          </select>
        </label>
        <label v-if="canManage" class="flex">
          <span
            class="rounded-l border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm whitespace-nowrap"
            >Draft for</span
          >
          <select
            v-model="target"
            class="form-input rounded-l-none"
            aria-label="Core system of the new draft"
            data-testid="target"
          >
            <option v-for="c in coreSystems" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </label>
      </div>
    </div>
    <CbsTabs />

    <p v-if="error" class="card px-4 py-3 text-sm text-danger" data-testid="load-error">{{ error }}</p>
    <p v-else-if="loading" class="py-6 text-center text-sm text-muted">loading…</p>
    <div v-else-if="!groups.length" class="card px-6 py-10 text-center" data-testid="no-samples">
      <p class="text-base font-medium text-ink">No validated sample yet</p>
      <p class="mx-auto mt-2 max-w-xl text-sm text-muted">
        <template v-if="coreSystem"
          >No query for {{ coreSystem }} has run as the active version yet, so none is known to
          work.</template
        >
        <template v-else>No query has run as the active version yet, so none is known to work.</template>
        A Database Administrator can start from a blank draft in the
        <RouterLink to="/cbs-queries" class="text-primary-1">overview</RouterLink>, or use a sample of another
        core system as a reference.
      </p>
    </div>
    <div v-else class="space-y-4">
      <div v-for="g in groups" :key="g.module.code" class="card" :data-testid="`group-${g.module.code}`">
        <header class="border-b border-slate-100 px-4 py-3">
          <h3 class="text-sm font-semibold text-project">{{ moduleName(g.module.code) }}</h3>
          <small class="text-xs text-muted">{{ g.module.code }}</small>
        </header>
        <ul class="divide-y divide-slate-100">
          <li v-for="s in g.samples" :key="s.id" class="px-4 py-3 text-sm" :data-testid="`sample-${s.id}`">
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-medium">{{ s.coreSystem }} version {{ s.versionNo }}</span>
              <span class="text-muted"
                >{{ s.activatedBy ? `activated by ${s.activatedBy}` : ''
                }}{{ s.activatedAt ? `, ${dateText(s.activatedAt)}` : '' }}</span
              >
              <span class="ml-auto flex gap-2">
                <button
                  type="button"
                  class="btn-outline !px-3 !py-1 text-xs"
                  data-testid="view-sql"
                  @click="show(s)"
                >
                  {{ open === s.id ? 'Hide SQL' : 'View SQL' }}
                </button>
                <RouterLink :to="`/cbs-queries/versions/${s.id}`" class="btn-outline !px-3 !py-1 text-xs"
                  >Details</RouterLink
                >
                <button
                  v-if="canManage"
                  type="button"
                  class="btn-primary-1 !px-3 !py-1 text-xs"
                  :disabled="busy !== null"
                  data-testid="use-as-draft"
                  @click="useAsDraft(s)"
                >
                  Use as draft
                </button>
              </span>
            </div>
            <p v-if="s.note" class="mt-1 text-muted">{{ s.note }}</p>
            <div v-if="open === s.id" class="mt-3" data-testid="sample-sql">
              <SqlEditor
                :model-value="sqlOf[s.id] ?? ''"
                readonly
                :rows="14"
                :label="`SQL of ${s.coreSystem} version ${s.versionNo}`"
              />
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
