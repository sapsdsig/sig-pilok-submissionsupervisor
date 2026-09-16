import { describe, expect, it } from 'vitest'
import {
  createStoredKtpFileName,
  sanitizeFileSegment,
  validExtensionForMimeType,
} from './drive.js'

describe('Drive KTP filename', () => {
  it('membersihkan nama dan menghasilkan nama yang readable serta collision-resistant', () => {
    const result = createStoredKtpFileName({
      namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
      areaName: 'Area 02',
      supervisorNo: 1,
      namaSupervisor: '../Budi Santóso',
      mimeType: 'application/pdf',
      originalFileName: '../../scan.PDF',
      requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
      now: new Date('2026-09-15T15:30:00.000Z'),
    })

    expect(result).toBe(
      'KTP_CENDRAWASIH_MULIA_PERKASA_PT_AREA_02_01_BUDI_SANTOSO_20260915T153000Z_123E4567.pdf',
    )
    expect(result).not.toContain('..')
  })

  it('menolak ketidaksesuaian MIME dan ekstensi', () => {
    expect(validExtensionForMimeType('ktp.jpg', 'image/jpeg')).toBe(true)
    expect(validExtensionForMimeType('ktp.pdf', 'image/jpeg')).toBe(false)
    expect(sanitizeFileSegment('../../')).toBe('TANPA_NAMA')
  })
})
