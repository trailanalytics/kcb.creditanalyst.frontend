import type { Finding } from '@/modules/cbsqueries/types'

/** A finding as the validator returns it; override what a test cares about. */
export const finding = (extra: Partial<Finding> = {}): Finding => ({
  ordinal: 1,
  severity: 'ERROR',
  code: 'MISSING_ALIAS',
  columnPosition: 1,
  foundText: null,
  expectedAlias: null,
  suggestedOffset: null,
  message: 'message',
  ...extra,
})

export const COLUMNS = [
  { ordinal: 1, name: 'CUS_ID', required: true, description: 'Customer id' },
  { ordinal: 2, name: 'CUS_NAME', required: true, description: null },
  { ordinal: 3, name: 'CUS_PHONE_1', required: false, description: null },
]

/** The JSON of GET /versions/{id} as the API section describes it. */
export const versionJson = (extra: Record<string, unknown> = {}) => ({
  id: 12,
  coreSystem: 'T24',
  module: {
    code: 'extract-customers',
    name: 'Extract customers',
    bindCount: 1,
    bindDescription: 'since date',
    columns: COLUMNS,
  },
  versionNo: 3,
  sql: 'SELECT A.ID AS CUS_ID\nFROM CUSTOMER A',
  status: 'DRAFT',
  isSample: false,
  note: 'work in progress',
  parentVersionId: 2,
  createdBy: 'Dan DBA',
  createdAt: '2026-10-20T08:00:00Z',
  submittedBy: null,
  submittedAt: null,
  activatedBy: null,
  activatedAt: null,
  latestValidation: null,
  reviews: [],
  events: [],
  canEdit: true,
  canSubmit: true,
  canReview: false,
  canActivate: false,
  ...extra,
})
