import { z } from 'zod'
import { MAX_KTP_FILE_SIZE_BYTES } from '../../../src/constants/files.js'
import { requireAllowedAppOrigin } from '../../_lib/appOrigin.js'
import {
  createResumableKtpSession,
  isAllowedKtpMimeType,
  validExtensionForMimeType,
} from '../../_lib/drive.js'
import { ApiError, rejectMethod, sendApiError } from '../../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import {
  getCanonicalRegion,
  getDistributorByCode,
} from '../../_lib/masterData.js'
import { requestTokenSchema } from '../../_lib/requestToken.js'

const sessionSchema = z
  .object({
    requestToken: requestTokenSchema,
    kodeDistributor: z.string().trim().min(1).max(100),
    provinsiId: z.string().trim().min(1).max(100),
    areaId: z.string().trim().min(1).max(100),
    supervisorNo: z.number().int().min(1).max(10),
    namaSupervisor: z.string().trim().min(1).max(150),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().refine(isAllowedKtpMimeType),
    size: z.number().int().positive().max(MAX_KTP_FILE_SIZE_BYTES),
  })
  .strict()
  .refine(
    (input) => validExtensionForMimeType(input.fileName, input.mimeType),
    { path: ['fileName'] },
  )

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return rejectMethod(response, 'POST')

  try {
    const origin = requireAllowedAppOrigin(request.headers.origin)
    const parsed = sessionSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ApiError(
        400,
        'KTP_INVALID',
        'Metadata KTP tidak valid. Gunakan JPG, JPEG, PNG, atau PDF maksimal 5 MB.',
      )
    }

    await Promise.all([
      getDistributorByCode(parsed.data.kodeDistributor),
      getCanonicalRegion(parsed.data.provinsiId, parsed.data.areaId),
    ])
    const session = await createResumableKtpSession({
      ...parsed.data,
      origin,
    })
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(session)
  } catch (error) {
    return sendApiError(response, error)
  }
}
