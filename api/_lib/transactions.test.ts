import { describe, expect, it } from 'vitest'
import { buildTransactionRecords } from './transactions.js'
import type { ValidatedSubmission } from './submissionValidation.js'

describe('transaction row generation', () => {
  it('membentuk parent, area, dan supervisor rows dari data kanonik', () => {
    const input: ValidatedSubmission = {
      requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
      distributor: {
        kodeDistributor: '0000000971',
        namaDistributor: 'NAMA DISTRIBUTOR KANONIK',
      },
      wilayah: [
        {
          province: { provinsiId: '11', provinsiName: 'ACEH' },
          area: { areaId: '502', areaName: 'Area 02', areaAp: 'SP' },
          supervisors: [
            {
              namaSupervisor: 'Budi',
              ktp: {
                fileId: 'file_123456789',
                fileName: 'KTP_BUDI.pdf',
                mimeType: 'application/pdf',
                fileUrl: 'https://drive.google.com/file/d/file_123456789/view',
              },
            },
            {
              namaSupervisor: 'Ani',
              ktp: {
                fileId: 'file_987654321',
                fileName: 'KTP_ANI.png',
                mimeType: 'image/png',
                fileUrl: 'https://drive.google.com/file/d/file_987654321/view',
              },
            },
          ],
        },
      ],
    }
    const result = buildTransactionRecords(
      input,
      new Date('2026-09-15T15:30:00.000Z'),
    )

    expect(result.submission.submission_id).toBe(result.submissionId)
    expect(result.submissionId).toMatch(/^SUP-20260915-[A-F0-9]{12}$/)
    expect(result.submission.nama_distributor).toBe('NAMA DISTRIBUTOR KANONIK')
    expect(result.areas[0]).toMatchObject({
      provinsi_name: 'ACEH',
      area_name: 'Area 02',
      area_ap: 'SP',
      jumlah_supervisor: 2,
    })
    expect(result.supervisors.map((row) => row.supervisor_no)).toEqual([1, 2])
    expect(result.supervisors[1]?.submission_area_id).toBe(
      result.areas[0]?.submission_area_id,
    )
  })
})
