<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { highlightOf, isEdited, isNumberText, REFERENCE, type GridRow } from '../gridModel'
import type { CbaColumn } from '../types'

/**
 * The excel-like table of `output_cba`. Every cell is a text input; the two key columns are read-only. Rows keep all 130 values
 * whatever columns are shown, so hiding a column never shifts the cells after it. Edits are reported to the page, which owns the rows.
 */
const props = defineProps<{
  columns: CbaColumn[]
  rows: GridRow[]
  /** One flag per column: shown or hidden. */
  visible: boolean[]
  /** The rule whose records are listed: its cells are marked. */
  rule: string
}>()
const emit = defineEmits<{
  edit: [row: number, col: number, value: string]
  clear: [row: number, col: number]
  restore: [row: number, col: number]
  hideRow: [row: number]
  removeRow: [row: number]
}>()

interface Menu {
  x: number
  y: number
  kind: 'row' | 'cell'
  row: number
  col: number
}
const menu = ref<Menu | null>(null)

const referenceColumn = computed(() => props.columns.findIndex((c) => c.key === REFERENCE))
const shown = computed(() => props.columns.map((c, i) => ({ c, i })).filter(({ i }) => props.visible[i]))

function cellClass(row: GridRow, col: number, column: CbaColumn): string[] {
  const classes = ['excel-cell', 'border', 'border-slate-300', 'p-0']
  const mark = props.rule ? highlightOf(props.rule, column.key) : null
  if (mark === 'primary') classes.push('bg-red-100')
  else if (mark === 'related') classes.push('bg-amber-50')
  else classes.push('bg-slate-50')
  if (column.numeric && isEdited(row, col) && !isNumberText(row.values[col] ?? ''))
    classes.push('ring-2', 'ring-danger', 'ring-inset')
  else if (isEdited(row, col)) classes.push('border-b-[3px]', 'border-b-[#14A44D]')
  return classes
}

function open(event: MouseEvent, kind: Menu['kind'], row: number, col: number) {
  event.preventDefault()
  menu.value = { x: event.clientX, y: event.clientY, kind, row, col }
}

function close() {
  menu.value = null
}

function choose(action: 'clear' | 'restore' | 'hideRow' | 'removeRow') {
  const m = menu.value
  close()
  if (!m) return
  if (action === 'hideRow') emit('hideRow', m.row)
  else if (action === 'removeRow') emit('removeRow', m.row)
  else if (action === 'clear') emit('clear', m.row, m.col)
  else emit('restore', m.row, m.col)
}

onMounted(() => window.addEventListener('click', close))
onBeforeUnmount(() => window.removeEventListener('click', close))
</script>

<template>
  <div id="table-container" class="max-h-[650px] overflow-auto rounded border border-slate-300 bg-white">
    <table class="excel-like w-max border-collapse text-sm">
      <thead>
        <tr>
          <th
            v-for="{ c } in shown"
            :key="c.key"
            class="sticky top-0 z-10 whitespace-nowrap border border-slate-300 bg-[#007bff] px-2 py-1 text-left font-bold text-white"
            :data-column="c.key"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, r) in rows"
          :key="row.id"
          class="cursor-pointer"
          :data-row="row.values[referenceColumn]"
        >
          <td
            v-for="{ c, i } in shown"
            :key="c.key"
            :class="cellClass(row, i, c)"
            @contextmenu="open($event, i === 0 ? 'row' : 'cell', r, i)"
          >
            <input
              type="text"
              class="block w-full min-w-[9rem] border-0 bg-transparent px-2 py-1 text-left outline-none focus:bg-white read-only:cursor-default read-only:text-slate-500"
              :value="row.values[i]"
              :readonly="c.readonly"
              :aria-label="`${c.label}, row ${r + 1}`"
              :data-cell="`${r}:${c.key}`"
              @input="emit('edit', r, i, ($event.target as HTMLInputElement).value)"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="menu"
      class="fixed z-50 w-48 rounded border border-slate-200 bg-white py-1 text-sm shadow-lg"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      role="menu"
      @click.stop
    >
      <template v-if="menu.kind === 'row'">
        <button
          type="button"
          role="menuitem"
          class="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
          @click="choose('hideRow')"
        >
          Hide Row
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
          @click="choose('removeRow')"
        >
          Remove From CBA
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          role="menuitem"
          class="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
          @click="choose('clear')"
        >
          Clear Content
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
          @click="choose('restore')"
        >
          Restore Content
        </button>
      </template>
      <hr class="my-1" />
      <button
        type="button"
        role="menuitem"
        class="block w-full px-3 py-1.5 text-left text-danger hover:bg-slate-100"
        @click="close"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
