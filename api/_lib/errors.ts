import type { ApiResponse } from './http.js'

export type ApiErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'REQUEST_INVALID'
  | 'APP_ORIGIN_NOT_ALLOWED'
  | 'DISTRIBUTOR_NOT_FOUND'
  | 'REGION_NOT_FOUND'
  | 'MASTER_DATA_CONFLICT'
  | 'SUBMISSION_INVALID'
  | 'KTP_INVALID'
  | 'UPLOAD_SESSION_ERROR'
  | 'GOOGLE_CONFIG_ERROR'
  | 'GOOGLE_API_ERROR'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function sendApiError(response: ApiResponse, error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      console.error('Supervisor API request failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      })
    }

    const publicMessage =
      error.status >= 500
        ? error.code === 'GOOGLE_CONFIG_ERROR'
          ? 'Konfigurasi layanan Google belum siap. Hubungi administrator.'
          : 'Layanan Google sedang tidak dapat diakses. Silakan coba kembali.'
        : error.message

    return response.status(error.status).json({
      error: { code: error.code, message: publicMessage },
    })
  }

  console.error('Unexpected Supervisor API failure', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  })
  return response.status(502).json({
    error: {
      code: 'GOOGLE_API_ERROR',
      message: 'Layanan Google sedang tidak dapat diakses. Silakan coba kembali.',
    },
  })
}

export function rejectMethod(response: ApiResponse, allowed: string) {
  response.setHeader('Allow', allowed)
  return response.status(405).json({
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Metode permintaan tidak didukung.',
    },
  })
}

export function requireSingleQuery(
  value: string | string[] | undefined,
  label: string,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'REQUEST_INVALID', `${label} wajib diisi.`)
  }
  return value.trim()
}

export function requireExactQueryString(
  value: string | string[] | undefined,
  label: string,
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(400, 'REQUEST_INVALID', `${label} wajib diisi.`)
  }
  return value
}
