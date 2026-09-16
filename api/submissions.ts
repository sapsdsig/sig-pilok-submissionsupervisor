import { cleanupUploadedKtps } from './_lib/drive.js'
import { rejectMethod, sendApiError } from './_lib/errors.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import {
  extractCleanupCandidates,
  validateAndNormalizeSubmission,
} from './_lib/submissionValidation.js'
import {
  hasStoredSubmission,
  persistSubmission,
  SubmissionPersistenceError,
} from './_lib/transactions.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return rejectMethod(response, 'POST')

  try {
    const validated = await validateAndNormalizeSubmission(request.body)
    const submission = await persistSubmission(validated)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({ submission })
  } catch (error) {
    const candidates = extractCleanupCandidates(request.body)
    if (candidates) {
      if (
        error instanceof SubmissionPersistenceError &&
        !error.writeAttempted
      ) {
        await cleanupUploadedKtps(candidates.requestToken, candidates.fileIds)
        return sendApiError(response, error)
      }
      try {
        const stored = await hasStoredSubmission(candidates.requestToken)
        if (!stored) {
          await cleanupUploadedKtps(
            candidates.requestToken,
            candidates.fileIds,
          )
        }
      } catch (cleanupCheckError) {
        // Ambiguous writes favor preserving files over deleting references that
        // may already have been committed to Sheets.
        console.error('KTP cleanup skipped because persistence could not be confirmed', {
          errorName:
            cleanupCheckError instanceof Error
              ? cleanupCheckError.name
              : 'UnknownError',
        })
      }
    }
    return sendApiError(response, error)
  }
}
