<script setup lang="ts">
import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { http } from '@/api/http'

/**
 * Replacement for common/SearchableSelect.vue: type to search `optionsUrl?query=`, pick several, shown as removable tags.
 * The endpoint returns `{ results: [{ value, text }] }`. Uses v-model instead of the old $parent.$emit event.
 */
export interface Option {
  value: string | number
  text: string
}

const props = withDefaults(
  defineProps<{ optionsUrl: string; placeholder?: string; modelValue: Option[] }>(),
  {
    placeholder: 'search item',
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: Option[]] }>()

const term = ref('')
const options = ref<Option[]>([])
const open = ref(false)
const loading = ref(false)
let requests = 0

const fetchOptions = useDebounceFn(async () => {
  requests += 1
  loading.value = true
  try {
    const { data } = await http.get<{ results: Option[] }>(props.optionsUrl, {
      params: { query: term.value },
    })
    if (data.results.length) {
      const needle = term.value.toLowerCase()
      const filtered = data.results.filter((o) => o.text.toLowerCase().includes(needle))
      options.value = filtered.length ? filtered : data.results
      open.value = true
    }
  } finally {
    requests -= 1
    if (requests === 0) loading.value = false
  }
}, 250)

function pick(option: Option) {
  if (!props.modelValue.some((s) => s.value === option.value))
    emit('update:modelValue', [...props.modelValue, option])
  term.value = ''
  open.value = false
}

const remove = (i: number) =>
  emit(
    'update:modelValue',
    props.modelValue.filter((_, idx) => idx !== i),
  )
const closeSoon = () => setTimeout(() => (open.value = false), 200)
</script>

<template>
  <div class="relative">
    <input
      v-model="term"
      type="text"
      class="w-full rounded border border-slate-300 px-3 py-2 focus:border-primary-1 focus:outline-none"
      :placeholder="placeholder"
      @input="fetchOptions"
      @blur="closeSoon"
    />
    <span v-if="loading" class="absolute right-3 top-2.5 text-xs text-muted">…</span>
    <ul
      v-if="open"
      class="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow"
    >
      <li v-for="o in options" :key="o.value">
        <button
          type="button"
          class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
          @click="pick(o)"
        >
          {{ o.text }}
        </button>
      </li>
    </ul>
    <div class="mt-1 flex flex-wrap gap-1">
      <span
        v-for="(s, i) in modelValue"
        :key="s.value"
        class="inline-flex items-center gap-1 rounded bg-primary-1 px-2 py-0.5 text-xs text-white"
      >
        {{ s.text }}
        <button
          type="button"
          class="rounded-full bg-white/80 px-1 text-primary-1"
          aria-label="remove"
          @click="remove(i)"
        >
          ×
        </button>
      </span>
    </div>
  </div>
</template>
