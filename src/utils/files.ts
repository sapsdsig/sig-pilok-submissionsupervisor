import {
  ALLOWED_KTP_EXTENSIONS,
  ALLOWED_KTP_MIME_TYPES,
} from '../constants/files'

export const isFileObject = (value: unknown): value is File =>
  typeof File !== 'undefined' && value instanceof File

export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : ''
}

export const isSupportedKtpFile = (file: File): boolean => {
  const supportedMime = ALLOWED_KTP_MIME_TYPES.includes(
    file.type.toLowerCase() as (typeof ALLOWED_KTP_MIME_TYPES)[number],
  )
  const supportedExtension = ALLOWED_KTP_EXTENSIONS.includes(
    getFileExtension(file.name) as (typeof ALLOWED_KTP_EXTENSIONS)[number],
  )

  // Beberapa browser/perangkat tidak mengirim MIME type. Jika MIME tersedia,
  // keduanya harus konsisten agar file tersamarkan tidak lolos validasi.
  return file.type ? supportedMime && supportedExtension : supportedExtension
}

export const resolveKtpMimeType = (file: File): string => {
  if (file.type) return file.type.toLowerCase()
  const extension = getFileExtension(file.name)
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'pdf') return 'application/pdf'
  return ''
}
