import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors.js'
import {
  validateAndNormalizeSubmission,
  type SubmissionValidationDependencies,
} from './submissionValidation.js'

const ktp = {
  fileId: 'file_123456789',
  fileName: 'KTP_0000000971_502_01_BUDI.pdf',
  mimeType: 'application/pdf',
  fileUrl: 'https://drive.google.com/file/d/file_123456789/view',
}

const validPayload = () => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
  kodeDistributor: '0000000971',
  wilayah: [
    {
      provinsiId: '11',
      areaId: '502',
      supervisors: [{ namaSupervisor: ' Budi Santoso ', ktp }],
    },
  ],
})

const dependencies = (): SubmissionValidationDependencies => ({
  getDistributor: vi.fn(async (code: string) => ({
    kodeDistributor: code,
    namaDistributor: 'NAMA KANONIK',
  })),
  getRegion: vi.fn(async () => ({
    province: { provinsiId: '11', provinsiName: 'ACEH' },
    area: { areaId: '502', areaName: 'Area 02', areaAp: 'SP' },
  })),
  verifyKtp: vi.fn(async () => ktp),
})

describe('backend submission validation', () => {
  it('menghasilkan nilai master dan metadata Drive yang terverifikasi', async () => {
    const result = await validateAndNormalizeSubmission(
      validPayload(),
      dependencies(),
    )
    expect(result.distributor.kodeDistributor).toBe('0000000971')
    expect(result.wilayah[0]?.province.provinsiName).toBe('ACEH')
    expect(result.wilayah[0]?.supervisors[0]?.namaSupervisor).toBe('Budi Santoso')
  })

  it('menolak kombinasi Wilayah duplikat sebelum memanggil Google', async () => {
    const payload = validPayload()
    payload.wilayah.push({ ...payload.wilayah[0]! })
    const mocks = dependencies()

    await expect(validateAndNormalizeSubmission(payload, mocks)).rejects.toMatchObject({
      code: 'SUBMISSION_INVALID',
    })
    expect(mocks.getDistributor).not.toHaveBeenCalled()
  })

  it('menolak relasi Area dan Provinsi yang gagal divalidasi master', async () => {
    const mocks = dependencies()
    mocks.getRegion = vi.fn(async () => {
      throw new ApiError(400, 'REGION_NOT_FOUND', 'Tidak valid')
    })
    await expect(validateAndNormalizeSubmission(validPayload(), mocks)).rejects.toMatchObject({
      code: 'REGION_NOT_FOUND',
    })
  })

  it('menolak metadata KTP client yang berbeda dari Drive', async () => {
    const mocks = dependencies()
    mocks.verifyKtp = vi.fn(async () => ({ ...ktp, fileName: 'canonical.pdf' }))
    await expect(validateAndNormalizeSubmission(validPayload(), mocks)).rejects.toMatchObject({
      code: 'KTP_INVALID',
    })
  })
})
