import { z } from 'zod'
import { cleanupUploadedKtps } from '../../_lib/drive.js'
import { ApiError, rejectMethod, sendApiError } from '../../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { referencedFileIds } from '../../_lib/transactions.js'
import { requestTokenSchema } from '../../_lib/requestToken.js'

const cleanupSchema = z
  .object({
    requestToken: requestTokenSchema,
    fileIds: z
      .array(z.string().trim().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/))
      .max(100),
  })
  .strict()

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return rejectMethod(response, 'POST')

  try {
    const parsed = cleanupSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ApiError(400, 'REQUEST_INVALID', 'Permintaan cleanup tidak valid.')
    }

    // A failed/ambiguous create or edit may have committed despite a lost
    // response. Never delete a newly uploaded file that Sheets references.
    const referenced = await referencedFileIds(parsed.data.fileIds)
    const unreferenced = parsed.data.fileIds.filter(
      (fileId) => !referenced.has(fileId),
    )
    const deleted = await cleanupUploadedKtps(
      parsed.data.requestToken,
      unreferenced,
    )
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({
      deleted,
      skippedBecauseReferenced: referenced.size,
    })
  } catch (error) {
    return sendApiError(response, error)
  }
}
