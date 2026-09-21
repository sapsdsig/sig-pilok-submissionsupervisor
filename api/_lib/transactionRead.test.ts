import { beforeEach, describe, expect, it, vi } from 'vitest'

const read = vi.hoisted(() => vi.fn())
vi.mock('./env.js', () => ({
  getSubmissionSheetConfig: () => ({
    spreadsheetId: 'submission-file',
    submissionSheetName: 'submission',
    submissionAreaSheetName: 'submission_area',
    submissionSupervisorSheetName: 'submission_supervisor',
  }),
}))
vi.mock('./sheets.js', () => ({
  readSheetTable: read,
}))

import {
  findStoredSubmissionByDistributor,
  getStoredSubmissionById,
} from './transactions.js'

const table = (sheet: string, parentCount = 1) => ({
  headers: [],
  rows:
    sheet === 'submission'
      ? Array.from({ length: parentCount }, (_, index) => ({
          rowNumber: index + 2,
          record: {
            submission_id: `SUP-${index}`,
            nama_distributor: 'DISTRIBUTOR',
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-02T00:00:00.000Z',
          },
        }))
      : sheet === 'submission_area'
        ? [{
            rowNumber: 2,
            record: {
              submission_area_id: 'AREA-1',
              submission_id: 'SUP-0',
              provinsi_name: 'ACEH',
              area_name: 'Area 02',
            },
          }]
        : [{
            rowNumber: 2,
            record: {
              supervisor_id: 'SPV-1',
              submission_id: 'SUP-0',
              submission_area_id: 'AREA-1',
              supervisor_no: '1',
              nama_supervisor: 'Budi',
              ktp_file_id: 'file_123456789',
              ktp_file_name: 'KTP_BUDI.pdf',
              ktp_file_url: 'https://drive.google.com/file/d/file_123456789/view',
            },
          }],
})

describe('existing submission reconstruction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    read.mockImplementation(async (_id: string, sheet: string) => table(sheet))
  })

  it('reconstructs normalized rows into the editable nested form', async () => {
    const response = await findStoredSubmissionByDistributor('distributor')

    expect(response).toMatchObject({
      submissionId: 'SUP-0',
      wilayah: [{
        submissionAreaId: 'AREA-1',
        supervisors: [{
          supervisorId: 'SPV-1',
          ktp: { kind: 'existing' },
        }],
      }],
    })
    const serialized = JSON.stringify(response)
    expect(serialized).not.toContain('ktp_file_url')
    expect(serialized).not.toContain('fileUrl')
    expect(serialized).not.toContain('webViewLink')
    expect(serialized).not.toContain('ktp_file_id')
    expect(serialized).not.toContain('fileId')
    expect(serialized).not.toContain('KTP_BUDI.pdf')
    expect(serialized).not.toContain('drive.google.com')
  })

  it('keeps stored KTP metadata available only to backend update logic', async () => {
    await expect(getStoredSubmissionById('SUP-0')).resolves.toMatchObject({
      submissionId: 'SUP-0',
      wilayah: [{
        submissionAreaId: 'AREA-1',
        supervisors: [{
          supervisorId: 'SPV-1',
          ktp: {
            fileId: 'file_123456789',
            fileName: 'KTP_BUDI.pdf',
            fileUrl:
              'https://drive.google.com/file/d/file_123456789/view',
          },
        }],
      }],
    })
  })

  it('returns null when the server confirms no parent exists', async () => {
    read.mockImplementation(async (_id: string, sheet: string) =>
      table(sheet, 0),
    )
    await expect(
      findStoredSubmissionByDistributor('DISTRIBUTOR'),
    ).resolves.toBeNull()
  })

  it('reports duplicate parent submissions as a conflict', async () => {
    read.mockImplementation(async (_id: string, sheet: string) =>
      table(sheet, 2),
    )
    await expect(
      findStoredSubmissionByDistributor('DISTRIBUTOR'),
    ).rejects.toMatchObject({ code: 'SUBMISSION_CONFLICT' })
  })
})
