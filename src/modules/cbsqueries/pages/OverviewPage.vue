<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { messageOf } from '@/api/http'
import { swalConfirm, toast } from '@/utils/dialogs'
import { cbsApi } from '../api'
import CbsTabs from '../components/CbsTabs.vue'
import { showApiError } from '../feedback'
import { dateText, latestInProgress, TONE_CLASS, validationBadge } from '../statusModel'
import type { CoreSystem, ModuleSummary, VersionSummary } from '../types'
import { useCbsAccess } from '../useCbsAccess'

/**
 * The 14 modules of one core system: the active version (number, who and when), whether it validated, how many samples exist,
 * and the actions: open the active version, start a draft (Database Administrator), open the latest version in progress.
 */
const router = useRouter()
const { canManage } = useCbsAccess()

const coreSystems = ref<CoreSystem[]>([])
const modules = ref<ModuleSummary[]>([])
const coreSystem = ref('')
const versions = ref<VersionSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)

async function loadVersions() {
  if (!coreSystem.value) return
  const asked = coreSystem.value
  try {
    const list = await cbsApi.versions({ coreSystem: asked, size: 200 })
    if (asked === coreSystem.value) versions.value = list
  } catch {
    // the grid still works without it, only the "in progress" links are missing
    versions.value = []
  }
}

onMounted(async () => {
  try {
    ;[coreSystems.value, modules.value] = await Promise.all([cbsApi.coreSystems(), cbsApi.modules()])
    // choosing the core system loads its versions (the watcher below)
    coreSystem.value = (coreSystems.value.find((c) => c.configured) ?? coreSystems.value[0])?.code ?? ''
  } catch (e) {
    error.value = messageOf(e, 'The modules could not be loaded. Please refresh and try again.')
  } finally {
    loading.value = false
  }
})
watch(coreSystem, loadVersions)

const inProgress = computed(() => latestInProgress(versions.value))
const rows = computed(() =>
  modules.value.map((m) => {
    const state = m.systems.find((s) => s.coreSystem === coreSystem.value)
    const active = state?.activeVersion ?? null
    const progress = inProgress.value.get(m.code)
    return {
      module: m,
      active,
      samples: state?.sampleCount ?? 0,
      progress,
      badge: validationBadge(active, progress),
    }
  }),
)

async function startDraft(row: (typeof rows.value)[number]) {
  if (row.progress) {
    const answer = await swalConfirm.fire({
      icon: 'question',
      html: `Version ${row.progress.versionNo} of this module is still in progress. Start another draft?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, start a draft',
      reverseButtons: true,
    })
    if (!answer.isConfirmed) return
  }
  busy.value = row.module.code
  try {
    const draft = await cbsApi.createDraft({
      coreSystem: coreSystem.value,
      module: row.module.code,
      ...(row.active ? { fromVersionId: row.active.id } : {}),
    })
    toast.success(`Draft version ${draft.versionNo} created.`)
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
        <span class="text-ink">CBS Query Configuration</span>
      </nav>
      <label class="ml-auto flex">
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
          <option v-for="c in coreSystems" :key="c.code" :value="c.code">
            {{ c.name }}{{ c.configured ? ' (configured)' : '' }}
          </option>
        </select>
      </label>
    </div>
    <CbsTabs />

    <p
      v-if="coreSystem && !coreSystems.find((c) => c.code === coreSystem)?.configured"
      class="mb-3 text-sm text-muted"
      data-testid="not-configured"
    >
      This bank does not run {{ coreSystem }}. Its queries stay stored but the extractors do not read them.
    </p>

    <div class="card overflow-x-auto">
      <table class="w-full text-left text-sm" data-testid="modules">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">Module</th>
            <th class="px-4 py-3">Active version</th>
            <th class="px-4 py-3">Validation</th>
            <th class="px-4 py-3">Samples</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.module.code"
            class="border-t border-slate-100 align-top hover:bg-[#F7FAFC]"
            :data-testid="`module-${r.module.code}`"
          >
            <td class="px-4 py-3">
              <span class="font-medium">{{ r.module.name }}</span>
              <small class="block text-xs text-muted"
                >{{ r.module.code }} · {{ r.module.columns.length }} columns, {{ r.module.bindCount }} bind{{
                  r.module.bindCount === 1 ? '' : 's'
                }}</small
              >
            </td>
            <td class="px-4 py-3" data-testid="active">
              <template v-if="r.active">
                <span class="font-medium" data-testid="active-no">Version {{ r.active.versionNo }}</span>
                <small class="block text-xs text-muted" data-testid="active-by"
                  >{{ r.active.activatedBy ? `by ${r.active.activatedBy}` : ''
                  }}{{ r.active.activatedAt ? `, ${dateText(r.active.activatedAt)}` : '' }}</small
                >
              </template>
              <span v-else class="text-muted" data-testid="no-active">None</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium"
                :class="TONE_CLASS[r.badge.tone]"
                data-testid="validation"
                >{{ r.badge.label }}</span
              >
            </td>
            <td class="px-4 py-3" data-testid="samples">
              <RouterLink
                :to="{ path: '/cbs-queries/samples', query: { coreSystem, module: r.module.code } }"
                class="text-primary-1"
                >{{ r.samples }}</RouterLink
              >
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <RouterLink
                v-if="r.active"
                :to="`/cbs-queries/versions/${r.active.id}`"
                class="btn-outline !px-3 !py-1 text-xs"
                data-testid="open-active"
                >Open active</RouterLink
              >
              <RouterLink
                v-if="r.progress"
                :to="`/cbs-queries/versions/${r.progress.id}`"
                class="btn-outline ml-2 !px-3 !py-1 text-xs"
                data-testid="open-progress"
                >Latest in progress (v{{ r.progress.versionNo }})</RouterLink
              >
              <button
                v-if="canManage"
                type="button"
                class="btn-primary-1 ml-2 !px-3 !py-1 text-xs"
                :disabled="busy !== null"
                data-testid="start-draft"
                @click="startDraft(r)"
              >
                Start draft
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="error" class="px-4 py-3 text-sm text-danger" data-testid="load-error">{{ error }}</p>
      <p v-else-if="loading" class="px-4 py-3 text-center text-sm text-muted">loading…</p>
    </div>
  </section>
</template>
