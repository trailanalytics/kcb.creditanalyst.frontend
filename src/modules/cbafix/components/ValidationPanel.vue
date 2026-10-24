<script setup lang="ts">
import { computed, ref } from 'vue'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { percentText } from '../gridModel'
import type { RuleResult, Validations } from '../types'

/** "CBA Validations": the 23 rules with their counts, the compact box and the full table in a dialog. */
const props = defineProps<{
  data: Validations | null
  loading: boolean
  failed: boolean
  /** The rule whose records the grid lists. */
  activeRule: string
  busy: boolean
}>()
const emit = defineEmits<{ view: [rule: string]; fix: [rule: string]; fixAll: []; clearRule: [] }>()

const expanded = ref(false)

const rules = computed<RuleResult[]>(() => (props.data ? Object.values(props.data.validations) : []))
const canFixAll = computed(() => rules.value.some((r) => r.fixable && r.count > 0))
const total = computed(() => props.data?.total_accounts ?? 0)
</script>

<template>
  <div class="card flex max-h-[350px] flex-col p-3 text-sm" data-testid="validations">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="font-semibold text-project">CBA Validations</h3>
      <button
        type="button"
        class="text-slate-500 hover:text-project"
        title="Show the full table"
        aria-label="Expand validations"
        @click="expanded = true"
      >
        ⤢
      </button>
    </div>
    <p v-if="loading" class="text-muted">loading...</p>
    <p v-else-if="failed" class="text-danger">Failed to load validation rules. Please try again.</p>
    <template v-else-if="data">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn-outline px-2 py-1 text-xs"
          :disabled="busy || !canFixAll"
          title="Runs every automatic fix in the recommended order"
          @click="emit('fixAll')"
        >
          Fix all
        </button>
        <span v-if="activeRule" class="rounded bg-amber-100 px-2 py-0.5 text-xs">
          Showing {{ activeRule }}
          <button
            type="button"
            class="ml-1 font-bold"
            aria-label="Show all records again"
            @click="emit('clearRule')"
          >
            ×
          </button>
        </span>
      </div>
      <div class="overflow-auto">
        <table class="w-full border-collapse text-xs">
          <thead class="text-muted">
            <tr>
              <th class="p-1 text-left">Rule</th>
              <th class="p-1 text-left">Rule %</th>
              <th class="p-1 text-left" colspan="2">Total Records</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rules"
              :key="r.name"
              class="border-t border-slate-100"
              :class="r.name === activeRule ? 'bg-amber-50' : ''"
              :data-rule="r.name"
            >
              <td class="p-1 font-medium">{{ r.name }}</td>
              <td class="p-1" :class="r.count > 0 ? 'text-danger' : 'text-slate-500'">
                {{ percentText(r.percentage) }} ({{ r.count }})
              </td>
              <td class="p-1">{{ total }}</td>
              <td class="whitespace-nowrap p-1 text-right">
                <template v-if="r.count > 0">
                  <button
                    v-if="r.fixable"
                    type="button"
                    class="mr-1 text-primary-1"
                    :aria-label="`Fix ${r.name}`"
                    title="Fix automatically"
                    :disabled="busy"
                    @click="emit('fix', r.name)"
                  >
                    Fix
                  </button>
                  <button
                    type="button"
                    class="text-success"
                    :aria-label="`Show ${r.name} records`"
                    title="Show the affected records"
                    @click="emit('view', r.name)"
                  >
                    View
                  </button>
                </template>
                <span v-else class="text-success" title="No records break this rule" aria-label="no records"
                  >✔</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <DialogRoot v-model:open="expanded" :modal="false">
    <DialogPortal>
      <div
        v-if="expanded"
        class="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        @click="expanded = false"
      ></div>
      <DialogContent
        class="fixed left-1/2 top-10 z-50 w-[min(72rem,92vw)] -translate-x-1/2 rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-3 text-base font-semibold text-project">CBA Validation</DialogTitle>
        <div class="max-h-[650px] overflow-auto">
          <table class="w-full border-collapse text-left text-sm" data-testid="validation-table">
            <thead class="sticky top-0 bg-white text-xs uppercase text-muted">
              <tr>
                <th class="border-b p-2">Rule Name</th>
                <th class="w-1/2 border-b p-2">Description</th>
                <th class="border-b p-2">Rule %</th>
                <th class="border-b p-2">Total Records</th>
                <th class="border-b p-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rules" :key="r.name" class="border-b border-slate-100">
                <td class="p-2 font-medium">{{ r.name }}</td>
                <td class="p-2">{{ r.desc }}</td>
                <td class="p-2" :class="r.count > 0 ? 'text-danger' : ''">
                  {{ percentText(r.percentage) }} ({{ r.count }})
                </td>
                <td class="p-2">{{ total }}</td>
                <td class="whitespace-nowrap p-2 text-right">
                  <template v-if="r.count > 0">
                    <button
                      v-if="r.fixable"
                      type="button"
                      class="mr-2 text-primary-1"
                      :disabled="busy"
                      @click="((expanded = false), emit('fix', r.name))"
                    >
                      Fix
                    </button>
                    <button
                      type="button"
                      class="text-success"
                      @click="((expanded = false), emit('view', r.name))"
                    >
                      View
                    </button>
                  </template>
                  <span v-else class="text-success">✔</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3 text-right">
          <button type="button" class="btn-outline" aria-label="Close" @click="expanded = false">
            Close
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
