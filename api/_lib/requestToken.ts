import { z } from 'zod'

export const REQUEST_TOKEN_PATTERN =
  /^\d{8}_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requestTokenSchema = z
  .string()
  .regex(REQUEST_TOKEN_PATTERN, 'Request token tidak valid.')

export function datePartFromRequestToken(requestToken: string): string {
  return requestToken.slice(0, 8)
}
