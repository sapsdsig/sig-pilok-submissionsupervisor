import type { SubmissionRequest, SubmissionResult } from '../types/api'
import { fetchJson } from './apiClient'

type SubmissionEnvelope = {
  submission: SubmissionResult
}

export interface SubmissionService {
  submit(payload: SubmissionRequest): Promise<SubmissionResult>
}

class ApiSubmissionService implements SubmissionService {
  async submit(payload: SubmissionRequest): Promise<SubmissionResult> {
    const result = await fetchJson<SubmissionEnvelope>('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return result.submission
  }
}

export const submissionService: SubmissionService = new ApiSubmissionService()
