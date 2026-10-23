<script setup lang="ts">
import { ref } from 'vue'

/** Replacement for DropFile.vue: drag a file onto the box or click to browse; emits the chosen File. */
const props = defineProps<{ accept?: string; label?: string }>()
const emit = defineEmits<{ file: [file: File | null] }>()

const input = ref<HTMLInputElement | null>(null)
const selected = ref<File | null>(null)
const over = ref(false)

function choose(file: File | undefined) {
  selected.value = file ?? null
  emit('file', selected.value)
}

function onDrop(event: DragEvent) {
  over.value = false
  choose(event.dataTransfer?.files?.[0])
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed px-4 py-8 text-center text-sm"
    :class="over ? 'border-primary-1 bg-blue-50' : 'border-slate-300'"
    role="button"
    tabindex="0"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
    @click="input?.click()"
    @keydown.enter="input?.click()"
  >
    <span v-if="selected" class="font-medium text-project">{{ selected.name }}</span>
    <span v-else class="text-muted">{{ props.label ?? 'Drag a file here or click to browse' }}</span>
    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="accept"
      @change="choose(($event.target as HTMLInputElement).files?.[0])"
    />
  </div>
</template>
