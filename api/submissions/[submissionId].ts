import { cleanupPersistedKtps } from '../_lib/drive.js'
import {
  rejectMethod,
  requireSingleQuery,
  sendApiError,
} from '../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { cleanupUnreferencedNewUploads } from '../_lib/submissionCleanup.js'
import {
  extractCleanupCandidates,
  validateAndNormalizeSubmission,
} from '../_lib/submissionValidation.js'
import {
  getStoredSubmissionById,
  updateSubmission,
} from '../_lib/transactions.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'PUT') return rejectMethod(response, 'PUT')

  try {
    const submissionId = requireSingleQuery(
      request.query.submissionId,
      'Submission ID',
    )
    const existing = await getStoredSubmissionById(submissionId)
    const validated = await validateAndNormalizeSubmission(
      request.body,
      existing,
    )
    const result = await updateSubmission(validated, existing)

    // This runs only after Sheets succeeds (or the ambiguous response is
    // positively confirmed as the intended persisted state).
    if (result.oldFileIdsToCleanup.length > 0) {
      await cleanupPersistedKtps(result.oldFileIdsToCleanup).catch((error) => {
        console.error('Post-update old KTP cleanup failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
      })
    }

    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({ submission: result.submission })
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
