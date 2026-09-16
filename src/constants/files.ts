// Batas Phase 2 yang dipakai bersama oleh validasi browser dan server.
// Ubah satu konstanta ini bila kebijakan file diperbarui pada Phase 3.
export const MAX_KTP_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_KTP_FILE_SIZE_LABEL = '5 MB'

export const ALLOWED_KTP_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

export const ALLOWED_KTP_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'] as const
export const KTP_FILE_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'
