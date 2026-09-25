import { rejectMethod, requireSingleQuery, sendApiError } from '../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { getCanonicalDistributorAp } from '../_lib/masterData.js'
import { findSubmissionState } from '../_lib/transactions.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')
  try {
    const requestedName = requireSingleQuery(request.query.namaDistributor, 'Nama Distributor')
    const requestedAp = requireSingleQuery(request.query.ap, 'AP')
    const canonical = await getCanonicalDistributorAp(requestedName, requestedAp)
    const result = await findSubmissionState(canonical.distributor.namaDistributor, canonical.ap.ap)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(result)
  } catch (error) { return sendApiError(response, error) }
}
