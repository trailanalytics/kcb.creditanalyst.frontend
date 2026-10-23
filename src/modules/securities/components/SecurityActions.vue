<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useSecurities } from '../useSecurities'
import type { SecurityContext } from '../types'

/**
 * The header buttons of a credit application or loan account: Add Guarantors, Add Collateral and Add Stakeholder. They only open
 * the dialogs rendered by <SecurityPanels> for the same context, so place both on the page. On a CAP the stakeholder button is for
 * company borrowers and "Existing Stakeholder" is offered (`existingStakeholder`); a loan account offers both for any borrower.
 */
const props = withDefaults(
  defineProps<{ context: SecurityContext; stakeholders?: boolean; existingStakeholder?: boolean }>(),
  { stakeholders: true, existingStakeholder: false },
)
const session = useSecurities(props.context)
const locked = computed(() => session.overview?.context.editable === false)

const item = 'block w-full px-4 py-2 text-left text-sm outline-none data-[highlighted]:bg-slate-100'
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <DropdownMenuRoot>
      <DropdownMenuTrigger class="btn-outline" :disabled="locked">Add Guarantors ▾</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          class="z-50 min-w-48 rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          <DropdownMenuItem
            :class="item"
            @select="session.openParty('guarantor', { mode: 'new', classification: '0' })"
          >
            Individual
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="item"
            @select="session.openParty('guarantor', { mode: 'new', classification: '1' })"
          >
            Non Individual
          </DropdownMenuItem>
          <DropdownMenuItem :class="item" @select="session.pickCustomer('guarantor')"
            >Existing Customer</DropdownMenuItem
          >
          <DropdownMenuItem v-if="existingStakeholder" :class="item" @select="session.pickStakeholder()">
            Existing Stakeholder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <button type="button" class="btn-outline" :disabled="locked" @click="session.openCollateral()">
      Add Collateral
    </button>

    <DropdownMenuRoot v-if="stakeholders">
      <DropdownMenuTrigger class="btn-outline" :disabled="locked">Add Stakeholder ▾</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          class="z-50 min-w-48 rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          <DropdownMenuItem
            :class="item"
            @select="session.openParty('stakeholder', { mode: 'new', classification: '0' })"
          >
            Individual
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="item"
            @select="session.openParty('stakeholder', { mode: 'new', classification: '1' })"
          >
            Non Individual
          </DropdownMenuItem>
          <DropdownMenuItem :class="item" @select="session.pickCustomer('stakeholder')"
            >Existing Customer</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
