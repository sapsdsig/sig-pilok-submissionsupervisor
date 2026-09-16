import { rejectMethod, sendApiError } from '../_lib/errors.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { getProvinces } from '../_lib/masterData.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')

  try {
    const provinces = await getProvinces()
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json(provinces)
  } catch (error) {
    return sendApiError(response, error)
  }
}
