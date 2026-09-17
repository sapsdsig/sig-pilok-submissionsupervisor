import { describe, expect, it } from 'vitest'
import type { StoredSubmission } from '../../src/types/api.js'
import type { ValidatedSubmission } from './submissionValidation.js'
import {
  buildTransactionRecords,
  deriveOldFileIdsToCleanup,
} from './transactions.js'

const input = (): ValidatedSubmission => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
  distributor: { namaDistributor: 'DISTRIBUTOR KANONIK' },
  wilayah: [
    {
      submissionAreaId: 'AREA-OLD',
      province: { provinsiName: 'ACEH' },
      area: { areaName: 'Area 02' },
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi',
          ktpSource: 'existing',
          ktp: {
            fileId: 'file_old_12345',
            fileName: 'KTP_OLD.pdf',
            mimeType: 'application/pdf',
            fileUrl: 'https://drive.google.com/file/d/file_old_12345/view',
          },
        },
        {
          namaSupervisor: 'Ani',
          ktpSource: 'new',
          ktp: {
            fileId: 'file_new_12345',
            fileName: 'KTP_NEW.png',
            mimeType: 'image/png',
            fileUrl: 'https://drive.google.com/file/d/file_new_12345/view',
          },
        },
      ],
    },
  ],
})
const stored: StoredSubmission = {
  submissionId: 'SUP-EXISTING',
  namaDistributor: 'DISTRIBUTOR KANONIK',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  wilayah: [
    {
      submissionAreaId: 'AREA-OLD',
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        {
          supervisorId: 'SPV-OLD',
          namaSupervisor: 'Budi',
          ktp: {
            fileId: 'file_old_12345',
            fileName: 'KTP_OLD.pdf',
            fileUrl: 'https://drive.google.com/file/d/file_old_12345/view',
          },
        },
        {
          supervisorId: 'SPV-DELETED',
          namaSupervisor: 'Deleted',
          ktp: {
            fileId: 'file_deleted_12345',
            fileName: 'KTP_DELETED.pdf',
            fileUrl: 'https://drive.google.com/file/d/file_deleted_12345/view',
          },
        },
      ],
    },
  ],
}

describe('Phase 4 transaction row generation', () => {
  it('derives jumlah_supervisor and supervisor_no from array order', () => {
    const records = buildTransactionRecords(input())
    expect(records.areas[0]?.jumlah_supervisor).toBe(2)
    expect(records.supervisors.map((row) => row.supervisor_no)).toEqual([1, 2])
  })

  it('does not write removed legacy columns', () => {
    const records = buildTransactionRecords(input())
    expect(records.submission).not.toHaveProperty('kode_distributor')
    expect(records.areas[0]).not.toHaveProperty('provinsi_id')
    expect(records.areas[0]).not.toHaveProperty('area_id')
    expect(records.areas[0]).not.toHaveProperty('area_ap')
  })

  it('uses one WIB timestamp for created_at and updated_at on create', () => {
    const records = buildTransactionRecords(
      input(),
      new Date('2026-09-17T03:36:55.376Z'),
    )

    expect(records.createdAt).toBe('2026-09-17 10:36:55')
    expect(records.updatedAt).toBe(records.createdAt)
    expect(records.submission.created_at).toBe(records.createdAt)
    expect(records.submission.updated_at).toBe(records.updatedAt)
  })

  it('preserves parent ID, created_at, and valid child IDs during edit', () => {
    const records = buildTransactionRecords(
      input(),
      new Date('2026-09-16T10:00:00.000Z'),
      stored,
    )
    expect(records.submissionId).toBe('SUP-EXISTING')
    expect(records.createdAt).toBe(stored.createdAt)
    expect(records.updatedAt).toBe('2026-09-16 17:00:00')
    expect(records.updatedAt).not.toBe(stored.updatedAt)
    expect(records.submission.created_at).toBe(stored.createdAt)
    expect(records.submission.updated_at).toBe(records.updatedAt)
    expect(records.areas[0]?.submission_area_id).toBe('AREA-OLD')
    expect(records.supervisors[0]?.supervisor_id).toBe('SPV-OLD')
  })

  it('schedules deleted old KTPs only after the replacement state is built', () => {
    const records = buildTransactionRecords(input(), new Date(), stored)
    expect(deriveOldFileIdsToCleanup(stored, records)).toEqual([
      'file_deleted_12345',
    ])
  })

  it('schedules the old KTP when a replacement file is persisted', () => {
    const changed = input()
    changed.wilayah[0]!.supervisors[0]!.ktp = {
      fileId: 'file_replacement_12345',
      fileName: 'KTP_REPLACEMENT.pdf',
      mimeType: 'application/pdf',
      fileUrl: 'https://drive.google.com/file/d/file_replacement_12345/view',
    }
    const records = buildTransactionRecords(changed, new Date(), stored)
    expect(deriveOldFileIdsToCleanup(stored, records)).toContain(
      'file_old_12345',
    )
    expect(deriveOldFileIdsToCleanup(stored, records)).not.toContain(
      'file_replacement_12345',
    )
  })
})
