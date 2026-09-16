import { rejectMethod, requireSingleQuery, sendApiError } from '../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { getCanonicalDistributor } from '../_lib/masterData.js'
import { findStoredSubmissionByDistributor } from '../_lib/transactions.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')

  try {
    const requestedName = requireSingleQuery(
      request.query.namaDistributor,
      'Nama Distributor',
    )
    const distributor = await getCanonicalDistributor(requestedName)
    const submission = await findStoredSubmissionByDistributor(
      distributor.namaDistributor,
    )
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(
      submission ? { exists: true, submission } : { exists: false },
    )
  } catch (error) {
    return sendApiError(response, error)
  }
}
