import { rejectMethod, requireSingleQuery, sendApiError } from './_lib/errors.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { getApOptions } from './_lib/masterData.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')
  try {
    const namaDistributor = requireSingleQuery(request.query.namaDistributor, 'Nama Distributor')
    const options = await getApOptions(namaDistributor)
    response.setHeader('Cache-Control', 'private, max-age=60')
    return response.status(200).json(options)
  } catch (error) { return sendApiError(response, error) }
}
