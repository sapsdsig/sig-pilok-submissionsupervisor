import { google } from 'googleapis'
import {
  ALLOWED_KTP_MIME_TYPES,
  MAX_KTP_FILE_SIZE_BYTES,
} from '../../src/constants/files.js'
import type { KtpUploadContext, UploadedKtp } from '../../src/types/api.js'
import { getDriveKtpFolderId } from './env.js'
import { ApiError } from './errors.js'
import { getGoogleAccessToken, getGoogleAuth } from './googleAuth.js'

const DRIVE_APP_MARKER = 'pilok-supervisor-v1'
const driveApi = () => google.drive({ version: 'v3', auth: getGoogleAuth() })

const MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
}

export function isAllowedKtpMimeType(value: string): boolean {
  return ALLOWED_KTP_MIME_TYPES.some((mimeType) => mimeType === value)
}

function extensionFrom(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

export function validExtensionForMimeType(
  fileName: string,
  mimeType: string,
): boolean {
  return MIME_EXTENSIONS[mimeType]?.includes(extensionFrom(fileName)) ?? false
}

export function sanitizeFileSegment(value: string, maxLength = 50): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength)
    .replace(/_+$/g, '')
  return normalized || 'TANPA_NAMA'
}

export function createStoredKtpFileName(input: {
  kodeDistributor: string
  areaId: string
  supervisorNo: number
  namaSupervisor: string
  mimeType: string
  originalFileName: string
  requestToken: string
  now?: Date
}): string {
  const allowedExtensions = MIME_EXTENSIONS[input.mimeType]
  if (!allowedExtensions) {
    throw new ApiError(400, 'KTP_INVALID', 'Format KTP tidak didukung.')
  }
  const originalExtension = extensionFrom(input.originalFileName)
  const extension = allowedExtensions.includes(originalExtension)
    ? originalExtension
    : allowedExtensions[0]
  const timestamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  const tokenSuffix = (input.requestToken.split('_').at(-1) ?? input.requestToken)
    .replaceAll('-', '')
    .slice(0, 8)
    .toUpperCase()

  return [
    'KTP',
    sanitizeFileSegment(input.kodeDistributor),
    sanitizeFileSegment(input.areaId),
    String(input.supervisorNo).padStart(2, '0'),
    sanitizeFileSegment(input.namaSupervisor),
    timestamp,
    tokenSuffix,
  ].join('_') + `.${extension}`
}

function contextProperties(context: KtpUploadContext) {
  return {
    application: DRIVE_APP_MARKER,
    requestToken: context.requestToken,
    kodeDistributor: context.kodeDistributor,
    provinsiId: context.provinsiId,
    areaId: context.areaId,
    supervisorNo: String(context.supervisorNo),
  }
}

export async function createResumableKtpSession(input: KtpUploadContext & {
  namaSupervisor: string
  fileName: string
  mimeType: string
  size: number
  origin: string
}) {
  if (
    !isAllowedKtpMimeType(input.mimeType) ||
    !validExtensionForMimeType(input.fileName, input.mimeType) ||
    input.size <= 0 ||
    input.size > MAX_KTP_FILE_SIZE_BYTES
  ) {
    throw new ApiError(400, 'KTP_INVALID', 'Metadata file KTP tidak valid.')
  }

  const storedFileName = createStoredKtpFileName({
    ...input,
    originalFileName: input.fileName,
  })
  const accessToken = await getGoogleAccessToken()
  const folderId = getDriveKtpFolderId()
  const url = new URL('https://www.googleapis.com/upload/drive/v3/files')
  url.searchParams.set('uploadType', 'resumable')
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('fields', 'id,name,mimeType,size,webViewLink')

  let googleResponse: Response
  try {
    googleResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.size),
        Origin: input.origin,
      },
      body: JSON.stringify({
        name: storedFileName,
        mimeType: input.mimeType,
        parents: [folderId],
        appProperties: contextProperties(input),
      }),
    })
  } catch {
    throw new ApiError(
      502,
      'UPLOAD_SESSION_ERROR',
      'Tidak dapat menghubungi Google Drive untuk membuat sesi upload.',
    )
  }

  const uploadUrl = googleResponse.headers.get('location')
  if (!googleResponse.ok || !uploadUrl) {
    throw new ApiError(
      502,
      'UPLOAD_SESSION_ERROR',
      'Sesi upload Google Drive gagal dibuat.',
    )
  }
  return { uploadUrl, storedFileName }
}

export async function verifyUploadedKtp(
  fileId: string,
  context: KtpUploadContext,
): Promise<UploadedKtp> {
  const folderId = getDriveKtpFolderId()
  let response
  try {
    response = await driveApi().files.get({
      fileId,
      fields: 'id,name,mimeType,size,webViewLink,parents,trashed,appProperties',
      supportsAllDrives: true,
    })
  } catch {
    throw new ApiError(
      400,
      'KTP_INVALID',
      'File KTP tidak ditemukan atau tidak dapat diverifikasi.',
    )
  }

  const file = response.data
  const size = Number(file.size)
  const expectedProperties = contextProperties(context)
  const propertiesMatch = Object.entries(expectedProperties).every(
    ([key, value]) => file.appProperties?.[key] === value,
  )
  if (
    !file.id ||
    !file.name ||
    !file.mimeType ||
    !file.webViewLink ||
    file.trashed ||
    !file.parents?.includes(folderId) ||
    !isAllowedKtpMimeType(file.mimeType) ||
    !validExtensionForMimeType(file.name, file.mimeType) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > MAX_KTP_FILE_SIZE_BYTES ||
    !propertiesMatch
  ) {
    throw new ApiError(
      400,
      'KTP_INVALID',
      'File KTP tidak valid atau bukan bagian dari submission ini.',
    )
  }

  return {
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    fileUrl: file.webViewLink,
  }
}

async function belongsToRequest(fileId: string, requestToken: string) {
  try {
    const response = await driveApi().files.get({
      fileId,
      fields: 'id,appProperties,trashed',
      supportsAllDrives: true,
    })
    return (
      !response.data.trashed &&
      response.data.appProperties?.application === DRIVE_APP_MARKER &&
      response.data.appProperties?.requestToken === requestToken
    )
  } catch {
    return false
  }
}

export async function cleanupUploadedKtps(
  requestToken: string,
  fileIds: readonly string[],
): Promise<number> {
  let deleted = 0
  for (const fileId of [...new Set(fileIds)]) {
    if (!(await belongsToRequest(fileId, requestToken))) continue
    try {
      await driveApi().files.delete({ fileId, supportsAllDrives: true })
      deleted += 1
    } catch (error) {
      console.error('Best-effort KTP cleanup failed', {
        fileId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }
  return deleted
}

export async function verifyDriveFolder(folderId: string) {
  let response
  try {
    response = await driveApi().files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,trashed,capabilities(canAddChildren)',
      supportsAllDrives: true,
    })
  } catch {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      'Folder Drive KTP tidak dapat diakses.',
    )
  }
  if (
    !response.data.id ||
    response.data.trashed ||
    response.data.mimeType !== 'application/vnd.google-apps.folder' ||
    response.data.capabilities?.canAddChildren !== true
  ) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      'Folder Drive KTP tidak valid atau tidak dapat menerima file.',
    )
  }
  return response.data.name ?? folderId
}
