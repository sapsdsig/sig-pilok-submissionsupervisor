import type {
  SubmissionLookupResponse,
  SubmissionRequest,
  SubmissionResult,
} from '../types/api'
import { fetchJson } from './apiClient'

type SubmissionEnvelope = { submission: SubmissionResult }

export interface SubmissionService {
  findByDistributor(namaDistributor: string): Promise<SubmissionLookupResponse>
  create(payload: SubmissionRequest): Promise<SubmissionResult>
  update(
    submissionId: string,
    payload: SubmissionRequest,
  ): Promise<SubmissionResult>
}

class ApiSubmissionService implements SubmissionService {
  findByDistributor(
    namaDistributor: string,
  ): Promise<SubmissionLookupResponse> {
    return fetchJson(
      `/api/submissions/by-distributor?namaDistributor=${encodeURIComponent(namaDistributor)}`,
    )
  }

  async create(payload: SubmissionRequest): Promise<SubmissionResult> {
    const result = await fetchJson<SubmissionEnvelope>('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return result.submission
  }

  async update(
    submissionId: string,
    payload: SubmissionRequest,
  ): Promise<SubmissionResult> {
    const result = await fetchJson<SubmissionEnvelope>(
      `/api/submissions/${encodeURIComponent(submissionId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    return result.submission
  }
}

export const submissionService: SubmissionService = new ApiSubmissionService()
