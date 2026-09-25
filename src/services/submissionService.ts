import type { SubmissionLookupResponse, SubmissionRequest, SubmissionResult } from '../types/api'
import { fetchJson } from './apiClient'

type SubmissionEnvelope = { submission: SubmissionResult }

export interface SubmissionService {
  findByDistributorAp(namaDistributor: string, ap: string): Promise<SubmissionLookupResponse>
  create(payload: SubmissionRequest): Promise<SubmissionResult>
  update(submissionId: string, payload: SubmissionRequest): Promise<SubmissionResult>
}

class ApiSubmissionService implements SubmissionService {
  findByDistributorAp(namaDistributor: string, ap: string): Promise<SubmissionLookupResponse> {
    return fetchJson(
      `/api/submissions/by-distributor-ap?namaDistributor=${encodeURIComponent(namaDistributor)}&ap=${encodeURIComponent(ap)}`,
    )
  }
  async create(payload: SubmissionRequest): Promise<SubmissionResult> {
    return (await fetchJson<SubmissionEnvelope>('/api/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })).submission
  }
  async update(submissionId: string, payload: SubmissionRequest): Promise<SubmissionResult> {
    return (await fetchJson<SubmissionEnvelope>(`/api/submissions/${encodeURIComponent(submissionId)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })).submission
  }
}

export const submissionService: SubmissionService = new ApiSubmissionService()
