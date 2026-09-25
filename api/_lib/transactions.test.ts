import { describe, expect, it } from 'vitest'
import type { ValidatedSubmission } from './submissionValidation.js'
import type { PersistedSubmission } from './transactionTypes.js'
import { buildTransactionRecords, deriveOldFileIdsToCleanup } from './transactions.js'

const input = (): ValidatedSubmission => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000', distributor: { namaDistributor: 'VENDOR A' }, ap: { ap: 'Supervisor AP1 SP' },
  supervisors: [
    { idMdxl: '1453366', namaSupervisor: 'APRIFALDI', ktpSource: 'not-required' },
    { idMdxl: '', namaSupervisor: 'CUSTOM', ktpSource: 'new', ktp: { fileId: 'file_new_12345', fileName: 'KTP.pdf', mimeType: 'application/pdf', fileUrl: 'https://drive.google.com/x' } },
  ],
})
const stored: PersistedSubmission = {
  submissionId: 'SUP-EXISTING', submissionAreaId: 'AREA-OLD', namaDistributor: 'VENDOR A', ap: 'Supervisor AP1 SP',
  createdAt: '2026-09-01 10:00:00', updatedAt: '2026-09-02 10:00:00',
  supervisors: [
    { supervisorId: 'SPV-BASE', idMdxl: '1453366', namaSupervisor: 'APRIFALDI' },
    { supervisorId: 'SPV-DELETED', idMdxl: '', namaSupervisor: 'OLD', ktp: { fileId: 'file_old_12345', fileName: 'OLD.pdf', fileUrl: 'https://drive.google.com/old' } },
  ],
}

describe('Phase 7 transaction generation', () => {
  it('creates exactly one AP row and derives count/order', () => {
    const records = buildTransactionRecords(input())
    expect(records.areas).toHaveLength(1); expect(records.areas[0]).toMatchObject({ ap: 'Supervisor AP1 SP', jumlah_supervisor: 2 })
    expect(records.supervisors.map((row) => row.supervisor_no)).toEqual([1, 2])
    expect(records.supervisors[0]).toMatchObject({ nama_distributor: 'VENDOR A', ap: 'Supervisor AP1 SP', id_mdxl: '1453366', ktp_file_id: '' })
    expect(records.supervisors[1]).toMatchObject({ id_mdxl: '', ktp_file_id: 'file_new_12345' })
  })
  it('uses WIB and preserves parent identity/created_at on edit', () => {
    const edit = input(); edit.submissionAreaId = 'AREA-OLD'; edit.supervisors[0]!.supervisorId = 'SPV-BASE'
    const records = buildTransactionRecords(edit, new Date('2026-09-17T03:36:55.376Z'), stored)
    expect(records.submissionId).toBe('SUP-EXISTING'); expect(records.createdAt).toBe(stored.createdAt); expect(records.updatedAt).toBe('2026-09-17 10:36:55')
    expect(records.areas[0]?.submission_area_id).toBe('AREA-OLD'); expect(records.supervisors[0]?.supervisor_id).toBe('SPV-BASE')
  })
  it('schedules deleted custom KTP only, never baseline cleanup', () => {
    const records = buildTransactionRecords(input(), new Date(), stored)
    expect(deriveOldFileIdsToCleanup(stored, records)).toEqual(['file_old_12345'])
  })
})
