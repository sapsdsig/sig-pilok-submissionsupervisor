import { describe, expect, it, vi } from 'vitest'
import type { SubmissionRequest } from '../../src/types/api.js'
import {
  validateAndNormalizeSubmission,
  type SubmissionValidationDependencies,
} from './submissionValidation.js'
import type { PersistedSubmission } from './transactionTypes.js'

const uploaded = {
  fileId: 'file_123456789',
  fileName: 'KTP_BUDI.pdf',
  mimeType: 'application/pdf',
  fileUrl: 'https://drive.google.com/file/d/file_123456789/view',
}
const payload = (): SubmissionRequest => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
  namaDistributor: 'distributor canonical',
  wilayah: [
    {
      provinsiName: 'aceh',
      areaName: 'area 02',
      supervisors: [
        { namaSupervisor: ' Budi ', ktp: { kind: 'new', ...uploaded } },
      ],
    },
  ],
})
const dependencies = (): SubmissionValidationDependencies => ({
  getDistributor: vi.fn(async () => ({
    namaDistributor: 'DISTRIBUTOR CANONICAL',
  })),
  getRegion: vi.fn(async () => ({
    province: { provinsiName: 'ACEH' },
    area: { areaName: 'Area 02' },
  })),
  verifyNewKtp: vi.fn(async () => uploaded),
  verifyExistingKtp: vi.fn(async () => uploaded),
})
const stored: PersistedSubmission = {
  submissionId: 'SUP-EXISTING',
  namaDistributor: 'DISTRIBUTOR CANONICAL',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  wilayah: [
    {
      submissionAreaId: 'AREA-OLD',
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi',
          ktp: uploaded,
        },
      ],
    },
  ],
}

describe('Phase 4 backend submission validation', () => {
  it('resolves canonical Distributor and Region names', async () => {
    const result = await validateAndNormalizeSubmission(
      payload(),
      null,
      dependencies(),
    )
    expect(result.distributor.namaDistributor).toBe('DISTRIBUTOR CANONICAL')
    expect(result.wilayah[0]?.province.provinsiName).toBe('ACEH')
    expect(result.wilayah[0]?.supervisors[0]?.namaSupervisor).toBe('Budi')
  })

  it('rejects duplicate Province and Area names', async () => {
    const input = payload()
    input.wilayah.push({ ...input.wilayah[0]! })
    await expect(
      validateAndNormalizeSubmission(input, null, dependencies()),
    ).rejects.toMatchObject({ code: 'SUBMISSION_INVALID' })
  })

  it('derives one-to-ten Supervisor validation from the array', async () => {
    const input = payload()
    input.wilayah[0]!.supervisors = []
    await expect(
      validateAndNormalizeSubmission(input, null, dependencies()),
    ).rejects.toMatchObject({ code: 'SUBMISSION_INVALID' })
  })

  it('requires a newly uploaded KTP during create', async () => {
    const input = payload()
    input.wilayah[0]!.supervisors[0]!.ktp = {
      kind: 'existing',
    }
    await expect(
      validateAndNormalizeSubmission(input, null, dependencies()),
    ).rejects.toMatchObject({ code: 'KTP_INVALID' })
  })

  it('allows reuse only when KTP belongs to the stored Supervisor', async () => {
    const input = payload()
    input.wilayah[0] = {
      submissionAreaId: 'AREA-OLD',
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi Baru',
          ktp: { kind: 'existing' },
        },
      ],
    }
    const deps = dependencies()
    await expect(
      validateAndNormalizeSubmission(input, stored, deps),
    ).resolves.toMatchObject({
      wilayah: [{ supervisors: [{ ktpSource: 'existing' }] }],
    })
    expect(deps.verifyExistingKtp).toHaveBeenCalledWith(
      uploaded.fileId,
      stored.wilayah[0]!.supervisors[0]!.ktp,
    )
  })

  it('rejects duplicate KTP files after server-side resolution', async () => {
    const persisted = structuredClone(stored)
    persisted.wilayah[0]!.supervisors.push({
      supervisorId: 'SPV-TWO',
      namaSupervisor: 'Ani',
      ktp: { ...uploaded },
    })
    const input = payload()
    input.wilayah[0] = {
      submissionAreaId: 'AREA-OLD',
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi',
          ktp: { kind: 'existing' },
        },
        {
          supervisorId: 'SPV-TWO',
          namaSupervisor: 'Ani',
          ktp: { kind: 'existing' },
        },
      ],
    }

    await expect(
      validateAndNormalizeSubmission(input, persisted, dependencies()),
    ).rejects.toMatchObject({ code: 'SUBMISSION_INVALID' })
  })

  it('rejects arbitrary child IDs', async () => {
    const input = payload()
    Object.assign(input.wilayah[0]!, { submissionAreaId: 'AREA-OTHER' })
    await expect(
      validateAndNormalizeSubmission(input, stored, dependencies()),
    ).rejects.toMatchObject({ code: 'SUBMISSION_INVALID' })
  })

  it('rejects client-provided metadata for a stored KTP', async () => {
    const input = payload()
    input.wilayah[0] = {
      submissionAreaId: 'AREA-OLD',
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi',
          ktp: Object.assign(
            { kind: 'existing' as const },
            { fileId: 'file_999999999' },
          ),
        },
      ],
    }
    await expect(
      validateAndNormalizeSubmission(input, stored, dependencies()),
    ).rejects.toMatchObject({ code: 'SUBMISSION_INVALID' })
  })
})
