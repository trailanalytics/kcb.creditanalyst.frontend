<script setup lang="ts">
import { ref } from 'vue'
import CommandsTab from '../components/CommandsTab.vue'
import ForexTab from '../components/ForexTab.vue'
import ImportsTab from '../components/ImportsTab.vue'
import MapClientsTab from '../components/MapClientsTab.vue'
import PasswordTab from '../components/PasswordTab.vue'

/** /t24/sync: T24 imports, commands, the warehouse login, client number mapping and forex rates. Opens on the first tab. */
const tabs = [
  { id: 'imports', label: 'T24 Imports' },
  { id: 'commands', label: 'T24 Commands' },
  { id: 'password', label: 'T24 Password' },
  { id: 'map', label: 'Map Client Numbers' },
  { id: 'forex', label: 'Forex Rates' },
] as const
const active = ref<(typeof tabs)[number]['id']>('imports')
</script>

<template>
  <section class="px-2 pt-2">
    <div class="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="active === t.id"
        class="-mb-px border-b-2 px-4 py-2 text-sm"
        :class="
          active === t.id
            ? 'border-project font-medium text-project'
            : 'border-transparent text-muted hover:text-ink'
        "
        @click="active = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <ImportsTab v-if="active === 'imports'" />
    <CommandsTab v-else-if="active === 'commands'" />
    <PasswordTab v-else-if="active === 'password'" />
    <MapClientsTab v-else-if="active === 'map'" />
    <ForexTab v-else />
  </section>
</template>
