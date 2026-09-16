import { ApiError } from './errors.js'

const LOCAL_APP_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function configuredOrigin(): string | undefined {
  const configured = process.env.APP_ORIGIN?.trim()
  if (!configured) return undefined

  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      'APP_ORIGIN bukan origin URL yang valid.',
    )
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== configured
  ) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      'APP_ORIGIN harus berupa origin tanpa path atau trailing slash.',
    )
  }
  return parsed.origin
}

export function isAllowedAppOrigin(origin: string): boolean {
  const productionOrigin = configuredOrigin()
  return (
    LOCAL_APP_ORIGINS.has(origin) ||
    (productionOrigin !== undefined && origin === productionOrigin)
  )
}

export function requireAllowedAppOrigin(
  originHeader: string | string[] | undefined,
): string {
  if (
    typeof originHeader !== 'string' ||
    !originHeader ||
    !isAllowedAppOrigin(originHeader)
  ) {
    throw new ApiError(
      403,
      'APP_ORIGIN_NOT_ALLOWED',
      'Origin aplikasi tidak diizinkan untuk membuat sesi upload.',
    )
  }
  return originHeader
}
