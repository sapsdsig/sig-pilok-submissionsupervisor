import { rejectMethod, requireSingleQuery, sendApiError } from '../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { getAreasByProvince } from '../_lib/masterData.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')

  try {
    const provinceId = requireSingleQuery(
      request.query.provinceId,
      'Provinsi ID',
    )
    const areas = await getAreasByProvince(provinceId)
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(areas)
  } catch (error) {
    return sendApiError(response, error)
  }
}
