import { z } from 'zod'
import { verifyUploadedKtp } from '../../_lib/drive.js'
import { ApiError, rejectMethod, sendApiError } from '../../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { requestTokenSchema } from '../../_lib/requestToken.js'

const verifySchema = z
  .object({
    requestToken: requestTokenSchema,
    fileId: z.string().trim().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/),
    kodeDistributor: z.string().trim().min(1).max(100),
    provinsiId: z.string().trim().min(1).max(100),
    areaId: z.string().trim().min(1).max(100),
    supervisorNo: z.number().int().min(1).max(10),
  })
  .strict()

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return rejectMethod(response, 'POST')

  try {
    const parsed = verifySchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ApiError(400, 'KTP_INVALID', 'Referensi file KTP tidak valid.')
    }
    const { fileId, ...context } = parsed.data
    const ktp = await verifyUploadedKtp(fileId, context)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(ktp)
  } catch (error) {
    return sendApiError(response, error)
  }
}
