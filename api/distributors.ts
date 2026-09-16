import { rejectMethod, sendApiError } from './_lib/errors.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { getDistributors } from './_lib/masterData.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return rejectMethod(response, 'GET')

  try {
    const query =
      typeof request.query.query === 'string' ? request.query.query : ''
    const distributors = await getDistributors(query)
    response.setHeader('Cache-Control', 'private, max-age=60')
    return response.status(200).json(distributors)
  } catch (error) {
    return sendApiError(response, error)
  }
}
