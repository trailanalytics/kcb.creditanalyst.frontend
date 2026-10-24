import { http } from '@/api/http'
import {
  listOf,
  toCoreSystem,
  toModuleSummary,
  toOutcome,
  toVersionDetail,
  toVersionSummary,
} from './normalize'
import type {
  CoreSystem,
  CreateDraftBody,
  ModuleSummary,
  ReviewBody,
  ValidationOutcome,
  VersionDetail,
  VersionSummary,
} from './types'

const base = '/cbs-queries'

/**
 * The /api/v1/cbs-queries calls. Failed mutations reject with the axios error: the pages show the server's message for a
 * 403 or 409 (see `showApiError`); 401, 419 and 5xx are answered by the global interceptor. The live check opts out
 * (`x-handled`) because the editor shows its failure inline.
 */
export const cbsApi = {
  coreSystems(): Promise<CoreSystem[]> {
    return http.get(`${base}/core-systems`).then((r) => listOf(r.data).map(toCoreSystem))
  },
  modules(): Promise<ModuleSummary[]> {
    return http.get(`${base}/modules`).then((r) => listOf(r.data).map(toModuleSummary))
  },
  /** Newest first. One page: the overview asks for a large one to find the latest version in progress per module. */
  versions(params: { coreSystem?: string; module?: string; status?: string; size?: number }) {
    return http.get(`${base}/versions`, { params }).then((r) => listOf(r.data).map(toVersionSummary))
  },
  version(id: number): Promise<VersionDetail> {
    return http.get(`${base}/versions/${id}`).then((r) => toVersionDetail(r.data))
  },
  samples(params: { coreSystem?: string; module?: string }): Promise<VersionSummary[]> {
    return http.get(`${base}/samples`, { params }).then((r) => listOf(r.data).map(toVersionSummary))
  },
  createDraft(body: CreateDraftBody): Promise<VersionDetail> {
    return http.post(`${base}/versions`, body).then((r) => toVersionDetail(r.data))
  },
  save(id: number, body: { sql: string; note: string }): Promise<VersionDetail> {
    return http.put(`${base}/versions/${id}`, body).then((r) => toVersionDetail(r.data))
  },
  validate(body: { module: string; sql: string }): Promise<ValidationOutcome> {
    return http
      .post(`${base}/validate`, body, { headers: { 'x-handled': '1' } })
      .then((r) => toOutcome(r.data))
  },
  submit(id: number): Promise<VersionDetail> {
    return http.post(`${base}/versions/${id}/submit`).then((r) => toVersionDetail(r.data))
  },
  review(id: number, body: ReviewBody): Promise<unknown> {
    return http.post(`${base}/versions/${id}/reviews`, body).then((r) => r.data)
  },
  revise(id: number): Promise<VersionDetail> {
    return http.post(`${base}/versions/${id}/revise`).then((r) => toVersionDetail(r.data))
  },
  activate(id: number): Promise<VersionDetail> {
    return http.post(`${base}/versions/${id}/activate`).then((r) => toVersionDetail(r.data))
  },
  promoteSample(id: number): Promise<unknown> {
    return http.post(`${base}/versions/${id}/promote-sample`).then((r) => r.data)
  },
  removeSample(id: number): Promise<unknown> {
    return http.delete(`${base}/versions/${id}/sample`).then((r) => r.data)
  },
}

export type CbsApi = typeof cbsApi
