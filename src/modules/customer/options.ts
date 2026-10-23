import { computed } from 'vue'
import dayjs from 'dayjs'
import { useReferenceStore, type RefItem } from '@/stores/reference'

export interface Opt {
  value: string
  label: string
}

const fromRef = (items: RefItem[]): Opt[] => items.map((i) => ({ value: i.code, label: i.value }))

/** Lookups the profile and application forms need. */
export const PROFILE_LOOKUPS = [
  'branches',
  'marital-statuses',
  'nationalities',
  'employment-types',
  'income-bands',
  'salary-frequencies',
  'business-types',
  'industries',
  'uganda-regions',
  'country-dialing-codes',
]

export function useProfileOptions() {
  const ref = useReferenceStore()
  return {
    load: () => ref.load(...PROFILE_LOOKUPS),
    branches: computed<Opt[]>(() => ref.branches.map((b) => ({ value: b.code ?? '', label: b.value }))),
    maritalStatuses: computed(() => fromRef(ref.items('marital-statuses'))),
    nationalities: computed(() => fromRef(ref.items('nationalities'))),
    employmentTypes: computed(() => fromRef(ref.items('employment-types'))),
    incomeBands: computed(() => fromRef(ref.items('income-bands'))),
    salaryFrequencies: computed(() => fromRef(ref.items('salary-frequencies'))),
    businessTypes: computed(() => fromRef(ref.items('business-types'))),
    industries: computed(() => fromRef(ref.items('industries'))),
    regions: computed(() => fromRef(ref.items('uganda-regions'))),
    /** "(256) Uganda" first, then every code as " (code) country". */
    dialingCodes: computed<Opt[]>(() => [
      { value: '256', label: '(256) Uganda' },
      ...ref.items('country-dialing-codes').map((i) => ({ value: i.code, label: ` (${i.code}) ${i.value}` })),
    ]),
  }
}

export const CLASSIFICATIONS: Opt[] = [
  { value: '0', label: 'Individual' },
  { value: '1', label: 'Non Individual' },
]

export const DAYS: Opt[] = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))
export const MONTHS: Opt[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: dayjs().month(i).format('MMMM'),
}))

/** Years from this year back to `to`. */
export const yearsBack = (to: number): Opt[] => {
  const now = dayjs().year()
  return Array.from({ length: now - to + 1 }, (_, i) => ({ value: String(now - i), label: String(now - i) }))
}
