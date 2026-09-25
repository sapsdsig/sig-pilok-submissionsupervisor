import type {
  KtpUploadContext,
  KtpUploadSessionRequest,
  KtpUploadSessionResponse,
  UploadedKtp,
} from '../types/api'
import { resolveKtpMimeType } from '../utils/files'
import { ApiClientError, fetchJson } from './apiClient'

type DriveUploadResponse = { id: string }

export type UploadKtpRequest = KtpUploadContext & {
  namaSupervisor: string
  file: File
}

export interface UploadService {
  uploadKtp(
    input: UploadKtpRequest,
    onProgress?: (percentage: number) => void,
    onFileCreated?: (fileId: string) => void,
  ): Promise<UploadedKtp>
  cleanup(requestToken: string, fileIds: readonly string[]): Promise<void>
}

function uploadFileDirectly(
  uploadUrl: string,
  file: File,
  mimeType: string,
  onProgress?: (percentage: number) => void,
): Promise<DriveUploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Type', mimeType)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener('error', () => {
      reject(
        new ApiClientError(
          'Upload KTP ke Google Drive terputus. Silakan coba kembali.',
          'DRIVE_UPLOAD_NETWORK_ERROR',
          0,
        ),
      )
    })
    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(
          new ApiClientError(
            'Upload KTP ke Google Drive gagal. Silakan coba kembali.',
            'DRIVE_UPLOAD_HTTP_ERROR',
            request.status,
          ),
        )
        return
      }
      try {
        const metadata = JSON.parse(request.responseText) as Partial<DriveUploadResponse>
        if (!metadata.id) throw new Error('Missing Drive file ID')
        resolve({ id: metadata.id })
      } catch {
        reject(
          new ApiClientError(
            'Respons upload Google Drive tidak dapat diverifikasi.',
            'DRIVE_UPLOAD_RESPONSE_ERROR',
            request.status,
          ),
        )
      }
    })
    request.send(file)
  })
}

class GoogleDriveUploadService implements UploadService {
  async uploadKtp(
    input: UploadKtpRequest,
    onProgress?: (percentage: number) => void,
    onFileCreated?: (fileId: string) => void,
  ): Promise<UploadedKtp> {
    const mimeType = resolveKtpMimeType(input.file)
    const sessionPayload: KtpUploadSessionRequest = {
      requestToken: input.requestToken,
      namaDistributor: input.namaDistributor,
      ap: input.ap,
      supervisorNo: input.supervisorNo,
      namaSupervisor: input.namaSupervisor,
      fileName: input.file.name,
      mimeType,
      size: input.file.size,
    }
    const session = await fetchJson<KtpUploadSessionResponse>(
      '/api/uploads/ktp/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload),
      },
    )

    const driveResponse = await uploadFileDirectly(
      session.uploadUrl,
      input.file,
      mimeType,
      onProgress,
    )
    onProgress?.(100)
    onFileCreated?.(driveResponse.id)

    return fetchJson<UploadedKtp>('/api/uploads/ktp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestToken: input.requestToken,
        fileId: driveResponse.id,
        namaDistributor: input.namaDistributor,
        ap: input.ap,
        supervisorNo: input.supervisorNo,
      }),
    })
  }

  async cleanup(requestToken: string, fileIds: readonly string[]): Promise<void> {
    if (fileIds.length === 0) return
    await fetchJson('/api/uploads/ktp/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken, fileIds }),
    })
  }
}

export const uploadService: UploadService = new GoogleDriveUploadService()
