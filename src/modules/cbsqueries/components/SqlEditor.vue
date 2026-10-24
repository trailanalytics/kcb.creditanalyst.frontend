<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * A monospace textarea with line numbers: no editor dependency. Lines never wrap (`wrap="off"`), so each number sits next to
 * its line, and the number column follows the textarea's scroll. `readonly` makes it a viewer that can still be selected.
 */
const model = defineModel<string>({ required: true })
const props = withDefaults(defineProps<{ readonly?: boolean; rows?: number; label?: string }>(), {
  rows: 22,
  label: 'SQL',
})

const area = ref<HTMLTextAreaElement | null>(null)
const gutter = ref<HTMLElement | null>(null)
const lineCount = computed(() => model.value.split('\n').length)
const height = computed(() => `${props.rows * 1.25 + 1}rem`)

function follow() {
  if (gutter.value && area.value) gutter.value.scrollTop = area.value.scrollTop
}

/** Put the caret at a character offset and show it, as after "Apply suggestion". */
function focusAt(offset: number) {
  const el = area.value
  if (!el) return
  el.focus()
  el.setSelectionRange(offset, offset)
}
defineExpose({ focusAt })
</script>

<template>
  <div
    class="flex overflow-hidden rounded border border-slate-300 bg-white font-mono text-[13px] leading-5 focus-within:border-primary-1"
    :style="{ height }"
    data-testid="sql-editor"
  >
    <div
      ref="gutter"
      class="w-12 shrink-0 select-none overflow-hidden border-r border-slate-200 bg-slate-50 py-2 pb-5 pr-2 text-right text-slate-400"
      aria-hidden="true"
      data-testid="line-numbers"
    >
      <div v-for="n in lineCount" :key="n">{{ n }}</div>
    </div>
    <textarea
      ref="area"
      v-model="model"
      class="h-full min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2 text-ink focus:outline-none read-only:bg-slate-50"
      wrap="off"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      :readonly="readonly"
      :aria-label="label"
      data-testid="sql"
      @scroll="follow"
    ></textarea>
  </div>
</template>
