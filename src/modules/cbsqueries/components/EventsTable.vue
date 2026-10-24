<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { whenText } from '../statusModel'
import type { AuditEvent } from '../types'

/** Audit events. `showVersion` adds the core system, module and version columns (the events page across versions). */
defineProps<{ events: AuditEvent[]; showVersion?: boolean }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm" data-testid="events">
      <thead class="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th class="px-4 py-3">When</th>
          <th class="px-4 py-3">Event</th>
          <th v-if="showVersion" class="px-4 py-3">Version</th>
          <th class="px-4 py-3">By</th>
          <th class="px-4 py-3">Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(e, i) in events"
          :key="e.id ?? i"
          class="border-t border-slate-100 align-top hover:bg-[#F7FAFC]"
          data-testid="event"
        >
          <td class="whitespace-nowrap px-4 py-2">{{ whenText(e.createdAt) }}</td>
          <td class="px-4 py-2 font-medium" data-testid="event-name">{{ e.event }}</td>
          <td v-if="showVersion" class="px-4 py-2">
            <RouterLink
              v-if="e.versionId !== null"
              :to="`/cbs-queries/versions/${e.versionId}`"
              class="text-primary-1"
              data-testid="event-version"
              >{{
                [e.coreSystem, e.module, e.versionNo !== null ? `v${e.versionNo}` : null]
                  .filter(Boolean)
                  .join(' / ') || `#${e.versionId}`
              }}</RouterLink
            >
          </td>
          <td class="px-4 py-2">{{ e.actor }}</td>
          <td class="px-4 py-2 break-words text-slate-600">{{ e.detail }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
