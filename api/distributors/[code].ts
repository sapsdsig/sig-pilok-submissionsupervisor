import {
  sendApiError,
  rejectMethod,
  requireExactQueryString,
} from '../_lib/errors.js'
import { getDistributorByCode } from '../_lib/masterData.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')

  try {
    const code = requireExactQueryString(request.query.code, 'Kode Distributor')
    const distributor = await getDistributorByCode(code)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(distributor)
  } catch (error) {
    return sendApiError(response, error)
  }
}
