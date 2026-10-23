<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { messageOf } from '@/api/http'
import type { Customer } from '@/modules/customer/types'
import { useAuthStore } from '@/stores/auth'
import { swalConfirm, swalNotification, toast } from '@/utils/dialogs'
import { formatNumber } from '@/utils/format'
import { collateralsApi, guarantorsApi } from '../api'
import { contextReference } from '../collateralModel'
import { useSecurities } from '../useSecurities'
import type { AttachResult, CollateralRow, GuarantorRow, SecurityContext, StakeholderRow } from '../types'
import CollateralModal from './CollateralModal.vue'
import ExistingCustomerModal from './ExistingCustomerModal.vue'
import ExistingStakeholderModal from './ExistingStakeholderModal.vue'
import PartyModal from './PartyModal.vue'

/**
 * The collateral, guarantor and stakeholder panels of a credit application (`{type:'application', referenceNumber}`) or a loan
 * account (`{type:'loan', contractCode}`), with every dialog they and <SecurityActions> open. Each panel shows the borrower's
 * records, not only the ones on this application or loan; the checkbox says whether the record is attached to it. A panel is
 * only drawn when the borrower has at least one record. Deleting goes through a deletion request (milestone 7) and is not offered.
 */
const props = defineProps<{ context: SecurityContext }>()
const session = useSecurities(props.context)
const auth = useAuthStore()
onMounted(() => session.reload())

const overview = computed(() => session.overview)
const editable = computed(() => overview.value?.context.editable !== false)
const ownerName = computed(() => overview.value?.borrower?.full_name.trim() || 'Customer')
const count = (n: number) => String(n).padStart(2, '0')
const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

async function confirmed(text: string): Promise<boolean> {
  const answer = await swalConfirm.fire({
    icon: 'warning',
    title: 'Confirm?',
    text,
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed',
    cancelButtonText: 'No, cancel',
    reverseButtons: true,
  })
  return answer.isConfirmed
}

/** The checkbox only shows what the server says: a click asks, and the answer decides. */
async function toggle<T extends { attached?: boolean }>(
  row: T,
  question: string,
  call: () => Promise<AttachResult>,
) {
  if (!editable.value) return
  if (!(await confirmed(question))) return
  try {
    const { message, attached } = await call()
    row.attached = attached
    toast.success(message)
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The change could not be saved.'))
  }
}

const toggleCollateral = (c: CollateralRow) =>
  toggle(c, c.attached ? 'Remove Collateral from Loan' : 'Attach Collateral to Loan.', () =>
    collateralsApi.attach(contextReference(props.context), c.CollateralReferenceNumber),
  )
const toggleGuarantor = (g: GuarantorRow) =>
  toggle(g, g.attached ? 'Remove guarantor from Loan' : 'Attach guarantor to Loan.', () =>
    guarantorsApi.attach(contextReference(props.context), g.id),
  )

const editGuarantor = (g: GuarantorRow) => session.openParty('guarantor', { mode: 'edit', row: g })
const editStakeholder = (s: StakeholderRow) => session.openParty('stakeholder', { mode: 'edit', row: s })

function customerPicked(customer: Customer) {
  session.customerPicker.open = false
  session.openParty(session.customerPicker.role, { mode: 'existing', customer })
}

function stakeholderPicked(row: StakeholderRow) {
  if (!row.stakeholder_profile)
    return void toast.error('The selected stakeholder does not have a customer profile.')
  session.stakeholderPicker.open = false
  session.openParty('guarantor', { mode: 'existing', customer: row.stakeholder_profile })
}

const menu = 'block w-full px-4 py-2 text-left text-sm outline-none data-[highlighted]:bg-slate-100'
</script>

<template>
  <div v-if="overview" data-testid="security-panels">
    <section v-if="overview.collaterals.length" class="mt-8" aria-label="Collateral">
      <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold text-project">
        {{ ownerName }}'s Collateral
        <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">{{
          count(overview.collaterals.length)
        }}</span>
      </h2>
      <div class="card">
        <div
          v-for="c in overview.collaterals"
          :key="c.id"
          class="group relative flex items-start gap-4 border-b border-slate-100 p-4 last:border-0 hover:bg-[#F7FAFC]"
        >
          <input
            :id="`collateralCheck${c.CollateralReferenceNumber}`"
            type="checkbox"
            class="mt-1"
            :checked="c.attached"
            :disabled="!editable"
            :aria-label="`Attach ${c.CollateralReferenceNumber}`"
            @click.prevent="toggleCollateral(c)"
          />
          <div class="grid flex-1 gap-3 text-sm md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,6fr)]">
            <div>
              {{ c.cmc_type }}<small class="block text-muted">{{ c.CollateralReferenceNumber }}</small>
            </div>
            <div>
              {{ c.CollateralCurrency }} {{ formatNumber(c.CollateralOpenMarketValue)
              }}<small class="block text-muted">Market Value</small>
            </div>
            <div>{{ c.CollateralDescription }}<small class="block text-muted">Description</small></div>
          </div>
          <div
            v-if="auth.has('Update Collateral')"
            class="md:invisible md:group-hover:visible md:group-focus-within:visible"
          >
            <DropdownMenuRoot>
              <DropdownMenuTrigger class="btn-outline" aria-label="Collateral actions"
                >Action ▾</DropdownMenuTrigger
              >
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  class="z-50 min-w-32 rounded border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <DropdownMenuItem :class="menu" @select="session.openCollateral(c)">Edit</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview.guarantors.length" class="mt-8" aria-label="Guarantors">
      <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold text-project">
        {{ ownerName }}'s Guarantors
        <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">{{
          count(overview.guarantors.length)
        }}</span>
      </h2>
      <div class="card">
        <div
          v-for="g in overview.guarantors"
          :key="g.id"
          class="group relative flex items-start gap-4 border-b border-slate-100 p-4 last:border-0 hover:bg-[#F7FAFC]"
        >
          <input
            :id="`guarantorCheck${g.id}`"
            type="checkbox"
            class="mt-1"
            :checked="g.attached"
            :disabled="!editable"
            :aria-label="`Attach guarantor ${g.GuarantorClientNumber}`"
            @click.prevent="toggleGuarantor(g)"
          />
          <div class="grid flex-1 gap-3 text-sm md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,6fr)]">
            <div>
              {{ g.guarantor_profile?.full_name.trim() || 'Unnamed customer'
              }}<small class="block text-muted">{{ g.GuarantorClientNumber }}</small>
            </div>
            <div>
              {{ dash(g.guarantor_profile?.II_FCSNumber) }}<small class="block text-muted">Fcs Number</small>
            </div>
            <div>
              {{ dash(g.guarantor_profile?.customer_type)
              }}<small class="block text-muted">Classification</small>
            </div>
          </div>
          <div
            v-if="auth.has('Update Guarantors')"
            class="md:invisible md:group-hover:visible md:group-focus-within:visible"
          >
            <DropdownMenuRoot>
              <DropdownMenuTrigger class="btn-outline" aria-label="Guarantor actions"
                >Action ▾</DropdownMenuTrigger
              >
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  class="z-50 min-w-32 rounded border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <DropdownMenuItem :class="menu" @select="editGuarantor(g)">Edit</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </div>
    </section>

    <section v-if="overview.stakeholders.length" class="mt-8" aria-label="Stakeholders">
      <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold text-project">
        {{ ownerName }}'s Stakeholders
        <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">{{
          count(overview.stakeholders.length)
        }}</span>
      </h2>
      <div class="card">
        <div
          v-for="s in overview.stakeholders"
          :key="s.id"
          class="group relative flex items-start gap-4 border-b border-slate-100 p-4 last:border-0 hover:bg-[#F7FAFC]"
        >
          <!-- a stakeholder is linked when it is saved and cannot be detached, so the box is always ticked -->
          <input
            type="checkbox"
            class="mt-1"
            checked
            disabled
            :aria-label="`Stakeholder ${s.StakeholderClientNumber}`"
          />
          <div class="grid flex-1 gap-3 text-sm md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,6fr)]">
            <div>
              {{ s.stakeholder_profile?.full_name.trim() || 'Unnamed customer'
              }}<small class="block text-muted">{{ s.StakeholderClientNumber }}</small>
            </div>
            <div>
              {{ dash(s.stakeholder_profile?.II_FCSNumber)
              }}<small class="block text-muted">Fcs Number</small>
            </div>
            <div>
              {{ dash(s.stakeholder_profile?.customer_type)
              }}<small class="block text-muted">Classification</small>
            </div>
          </div>
          <div
            v-if="auth.has('Update Stakeholder')"
            class="md:invisible md:group-hover:visible md:group-focus-within:visible"
          >
            <DropdownMenuRoot>
              <DropdownMenuTrigger class="btn-outline" aria-label="Stakeholder actions"
                >Action ▾</DropdownMenuTrigger
              >
              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  class="z-50 min-w-32 rounded border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <DropdownMenuItem :class="menu" @select="editStakeholder(s)">Edit</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </div>
    </section>
  </div>

  <CollateralModal
    v-model:open="session.collateralDialog.open"
    :collateral="session.collateralDialog.item"
    :context="context"
    @saved="session.reload()"
  />
  <PartyModal
    v-model:open="session.partyDialog.open"
    :kind="session.partyDialog.kind"
    :start="session.partyDialog.start"
    :version="session.partyDialog.version"
    :context="context"
    @saved="session.reload()"
  />
  <ExistingCustomerModal v-model:open="session.customerPicker.open" @select="customerPicked" />
  <ExistingStakeholderModal
    v-model:open="session.stakeholderPicker.open"
    :borrower="overview?.context.clientNumber ?? ''"
    @select="stakeholderPicked"
  />
</template>
