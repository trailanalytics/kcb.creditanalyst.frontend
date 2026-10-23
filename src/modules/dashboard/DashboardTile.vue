<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Tile, TileAction } from './types'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

/** One dashboard card (home.blade.php): icon, title link, subtitle, footer link and an optional "more" menu. */
defineProps<{ tile: Tile }>()
const emit = defineEmits<{ action: [action: TileAction] }>()
</script>

<template>
  <div
    class="flex flex-col rounded border-2 border-transparent bg-white shadow-md transition hover:border-kcb-green hover:shadow-lg"
  >
    <div class="flex items-center gap-3 px-5 pb-8 pt-5">
      <img
        v-if="tile.icon"
        :src="tile.icon.startsWith('/') ? tile.icon : `/img/icons/${tile.icon}`"
        alt=""
        width="70"
        class="shrink-0"
      />
      <div v-else class="h-[70px] w-[70px] shrink-0 rounded bg-slate-100" />
      <div class="pt-2">
        <RouterLink :to="tile.to" class="text-xl font-semibold text-slate-600">{{ tile.title }}</RouterLink>
        <br />
        <span class="text-muted">{{ tile.subtitle }}</span>
      </div>
    </div>
    <div class="mt-auto flex items-center border-t border-slate-100">
      <div class="flex-1 py-3 text-center text-sm">
        <RouterLink :to="tile.footerTo ?? tile.to" class="text-primary-1">{{ tile.footer }}</RouterLink>
      </div>
      <DropdownMenuRoot v-if="tile.menu?.length">
        <DropdownMenuTrigger
          class="px-4 py-3 text-slate-400 hover:text-slate-600 focus:outline-none"
          aria-label="More"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="end"
            :side-offset="4"
            class="z-50 max-h-80 min-w-56 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
          >
            <DropdownMenuItem v-for="m in tile.menu" :key="m.to ?? m.action" as-child>
              <button
                v-if="m.action"
                type="button"
                class="block w-full px-4 py-2 text-left text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                @click="emit('action', m.action)"
              >
                {{ m.label }}
              </button>
              <RouterLink
                v-else
                :to="m.to ?? '/'"
                class="block px-4 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
              >
                {{ m.label }}
              </RouterLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>
