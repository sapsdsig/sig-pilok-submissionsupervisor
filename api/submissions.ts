import { rejectMethod, sendApiError } from './_lib/errors.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { cleanupUnreferencedNewUploads } from './_lib/submissionCleanup.js'
import {
  extractCleanupCandidates,
  validateAndNormalizeSubmission,
} from './_lib/submissionValidation.js'
import { persistSubmission } from './_lib/transactions.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return rejectMethod(response, 'POST')

  try {
    const validated = await validateAndNormalizeSubmission(request.body, null)
    const submission = await persistSubmission(validated)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({ submission })
  } catch (error) {
    const candidates = extractCleanupCandidates(request.body)
    if (candidates) {
      await cleanupUnreferencedNewUploads(
        candidates.requestToken,
        candidates.fileIds,
      )
    }
    return sendApiError(response, error)
  }
}
