<script setup lang="ts">
import { computed } from 'vue'
import { useProfile } from '../profileContext'
import type { Opt } from '../options'

/** A text box or a select bound to one field of the profile form. */
const props = defineProps<{
  name: string
  options?: Opt[]
  /** Label of the empty first option of a select ("Select Branch"). Omit for no blank option. */
  blank?: string
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  type?: string
  /** Extra width classes when several controls share a row. */
  width?: string
}>()
const emit = defineEmits<{ change: [value: string] }>()
const ctx = useProfile()

const elementId = computed(() => `${ctx.id}-${props.name}`)
const value = computed(() => ctx.form[props.name] ?? '')
const bad = computed(() => ctx.invalid.value.includes(props.name))

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement | HTMLSelectElement).value
  ctx.set(props.name, v)
  emit('change', v)
}
</script>

<template>
  <select
    v-if="options"
    :id="elementId"
    :value="value"
    :disabled="disabled"
    :name="name"
    class="form-input"
    :class="[width ?? 'flex-1', { 'is-invalid': bad }]"
    @change="onInput"
  >
    <option v-if="blank !== undefined" value="">{{ blank }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
  <input
    v-else
    :id="elementId"
    :value="value"
    :name="name"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :readonly="readonly"
    :disabled="disabled"
    class="form-input"
    :class="[width ?? 'flex-1', { 'is-invalid': bad }]"
    @input="onInput"
  />
</template>
