<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { problemOf } from '@/api/http'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { failureMessage } from '@/modules/application/submit'
import { useReferenceStore } from '@/stores/reference'
import { hideLoader, showLoader, swalNotification, toast } from '@/utils/dialogs'
import { collateralsApi } from '../api'
import {
  checkCollateral,
  collateralFrom,
  collateralPayload,
  emptyCollateral,
  type CollateralForm,
} from '../collateralModel'
import type { CollateralRow, SecurityContext } from '../types'

/**
 * Add / Update Collateral (cap/security/add_collateral.blade.php). With a collateral it edits that record; without one it adds a new
 * collateral for the borrower of the credit application or loan account in `context`.
 */
const props = defineProps<{ collateral: CollateralRow | null; context?: SecurityContext }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [row: CollateralRow] }>()

const ref_ = useReferenceStore()
onMounted(() => ref_.load('collateral-classifications', 'currencies', 'instruments-of-claim'))

const form = ref<CollateralForm>(emptyCollateral())
const errors = ref<Record<string, string[]>>({})
const busy = ref(false)
const editing = computed(() => props.collateral !== null)

// the form is rebuilt when the dialog opens for another record; closing and reopening after an error keeps what was typed
watch(
  () => [open.value, props.collateral?.id] as const,
  ([isOpen], [wasOpen]) => {
    if (isOpen && !wasOpen) {
      form.value = props.collateral ? collateralFrom(props.collateral) : emptyCollateral()
      errors.value = {}
    }
  },
)

const types = computed(() => ref_.items('collateral-classifications'))
const instruments = computed(() => ref_.items('instruments-of-claim'))
const currencies = computed(() => ref_.items('currencies').filter((c) => c.code !== 'UGX'))
const bad = (field: string) => (errors.value[field] ? 'is-invalid' : '')

async function submit() {
  const message = checkCollateral(form.value)
  if (message) return void toast.error(message)

  busy.value = true
  showLoader('processing...')
  try {
    const body = collateralPayload(form.value, props.context)
    const row = props.collateral
      ? await collateralsApi.update(props.collateral.id, body)
      : await collateralsApi.create(body)
    hideLoader()
    open.value = false
    toast.success(' Collateral Saved Successfully')
    emit('saved', row)
  } catch (e) {
    errors.value = problemOf(e)?.errors ?? {}
    // the dialog traps focus, so it steps aside while the message is up
    open.value = false
    await swalNotification('error', failureMessage(e))
    open.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-12 z-50 max-h-[88vh] w-[min(46rem,94vw)] -translate-x-1/2 overflow-y-auto rounded bg-white p-6 shadow-xl focus:outline-none"
        aria-describedby="undefined"
        @interact-outside.prevent
      >
        <DialogTitle class="mb-4 text-base font-semibold uppercase tracking-wide text-project">
          {{ editing ? 'Update Collateral' : 'Add Collateral' }}
        </DialogTitle>
        <form id="collateral-form" novalidate class="space-y-3" @submit.prevent="submit">
          <div class="flex items-center gap-4">
            <label for="cm-type" class="w-1/3 text-right text-sm">Type</label>
            <select
              id="cm-type"
              v-model="form.CollateralType"
              class="form-input flex-1"
              :class="bad('CollateralType')"
              required
            >
              <option value="">--Select--</option>
              <option v-for="t in types" :key="t.code" :value="t.code">{{ t.value }}</option>
            </select>
          </div>
          <div class="flex items-center gap-4">
            <label for="cm-currency" class="w-1/3 text-right text-sm">Currency</label>
            <select
              id="cm-currency"
              v-model="form.CollateralCurrency"
              class="form-input flex-1"
              :class="bad('CollateralCurrency')"
              required
            >
              <option value="">--Select--</option>
              <option value="UGX">UGX (Uganda)</option>
              <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
            </select>
          </div>
          <div class="flex items-center gap-4">
            <label class="w-1/3 text-right text-sm">Force Sale Value</label>
            <MoneyInput
              v-model="form.CollateralForcedSaleValue"
              name="CollateralForcedSaleValue"
              class="flex-1"
              placeholder="Force Sale Value"
            />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-1/3 text-right text-sm">Open Market Value</label>
            <MoneyInput
              v-model="form.CollateralOpenMarketValue"
              name="CollateralOpenMarketValue"
              class="flex-1"
              placeholder="Open Market Value"
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="cm-valuation" class="w-1/3 text-right text-sm">Valuation Date</label>
            <input
              id="cm-valuation"
              v-model="form.valuationDate"
              type="date"
              class="form-input flex-1"
              :class="bad('valuationDate')"
              required
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="cm-expiry" class="w-1/3 text-right text-sm">Valuation Expiry Date</label>
            <input
              id="cm-expiry"
              v-model="form.expiryDate"
              type="date"
              class="form-input flex-1"
              :class="bad('expiryDate')"
              required
            />
          </div>
          <div class="flex items-center gap-4">
            <label for="cm-instrument" class="w-1/3 text-right text-sm">Instrument Of Claim</label>
            <select
              id="cm-instrument"
              v-model="form.InstrumentofClaim"
              class="form-input flex-1"
              :class="bad('InstrumentofClaim')"
              required
            >
              <option value="">--Select--</option>
              <option v-for="i in instruments" :key="i.code" :value="i.value">{{ i.value }}</option>
            </select>
          </div>
          <div class="flex items-start gap-4">
            <label for="cm-description" class="w-1/3 pt-2 text-right text-sm">Description</label>
            <textarea
              id="cm-description"
              v-model="form.CollateralDescription"
              rows="5"
              class="form-input flex-1"
              :class="bad('CollateralDescription')"
              required
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <DialogClose class="btn-outline" type="button">Cancel</DialogClose>
            <button type="submit" class="btn-system" :disabled="busy">Save</button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
