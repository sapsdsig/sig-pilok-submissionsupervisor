import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredSubmission } from '../../src/types/api.js'
import type { ValidatedSubmission } from './submissionValidation.js'

const mocks = vi.hoisted(() => ({
  readSheetTable: vi.fn(),
  getSheetIdMap: vi.fn(),
  appendTablesAtomically: vi.fn(),
  executeSpreadsheetBatchUpdate: vi.fn(),
}))
vi.mock('./env.js', () => ({
  getSubmissionSheetConfig: () => ({
    spreadsheetId: 'submission-spreadsheet-id',
    submissionSheetName: 'submission',
    submissionAreaSheetName: 'submission_area',
    submissionSupervisorSheetName: 'submission_supervisor',
  }),
}))
vi.mock('./sheets.js', () => ({
  readSheetTable: mocks.readSheetTable,
  getSheetIdMap: mocks.getSheetIdMap,
  appendTablesAtomically: mocks.appendTablesAtomically,
  executeSpreadsheetBatchUpdate: mocks.executeSpreadsheetBatchUpdate,
  extendedCellValue: (value: string | number | undefined) =>
    typeof value === 'number'
      ? { numberValue: value }
      : { stringValue: value ?? '' },
}))

import { persistSubmission, updateSubmission } from './transactions.js'

const input: ValidatedSubmission = {
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
  distributor: { namaDistributor: 'DISTRIBUTOR' },
  wilayah: [
    {
      province: { provinsiName: 'ACEH' },
      area: { areaName: 'Area 02' },
      supervisors: [
        {
          namaSupervisor: 'Budi',
          ktpSource: 'new',
          ktp: {
            fileId: 'file_123456789',
            fileName: 'KTP_BUDI.pdf',
            mimeType: 'application/pdf',
            fileUrl: 'https://drive.google.com/file/d/file_123456789/view',
          },
        },
      ],
    },
  ],
}
const headers = (sheet: string) =>
  sheet === 'submission'
    ? ['submission_id', 'nama_distributor', 'created_at', 'updated_at']
    : sheet === 'submission_area'
      ? ['submission_area_id', 'submission_id', 'provinsi_name', 'area_name', 'jumlah_supervisor']
      : ['supervisor_id', 'submission_id', 'submission_area_id', 'nama_distributor', 'provinsi', 'area', 'supervisor_no', 'nama_supervisor', 'ktp_file_id', 'ktp_file_name', 'ktp_file_url']

describe('Phase 4 transaction spreadsheet routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSheetIdMap.mockResolvedValue(
      new Map([
        ['submission', 1],
        ['submission_area', 2],
        ['submission_supervisor', 3],
      ]),
    )
    mocks.appendTablesAtomically.mockResolvedValue(undefined)
    mocks.executeSpreadsheetBatchUpdate.mockResolvedValue(undefined)
    mocks.readSheetTable.mockImplementation(
      async (_id: string, sheet: string) => ({
        headers: headers(sheet),
        rows: [],
      }),
    )
  })

  it('creates all transaction rows only in the submission spreadsheet', async () => {
    await persistSubmission(input)
    expect(mocks.readSheetTable).toHaveBeenCalledTimes(3)
    expect(mocks.readSheetTable.mock.calls.every((call) =>
      call[0] === 'submission-spreadsheet-id',
    )).toBe(true)
    expect(mocks.appendTablesAtomically).toHaveBeenCalledWith(
      'submission-spreadsheet-id',
      expect.any(Array),
    )
  })

  it('rejects create when Distributor already has a parent submission', async () => {
    mocks.readSheetTable.mockImplementation(
      async (_id: string, sheet: string) => ({
        headers: headers(sheet),
        rows: sheet === 'submission'
          ? [{ rowNumber: 2, record: {
              submission_id: 'SUP-EXISTING',
              nama_distributor: 'DISTRIBUTOR',
              created_at: '2026-09-01T00:00:00.000Z',
              updated_at: '2026-09-01T00:00:00.000Z',
            } }]
          : [],
      }),
    )
    await expect(persistSubmission(input)).rejects.toMatchObject({
      code: 'SUBMISSION_CONFLICT',
    })
    expect(mocks.appendTablesAtomically).not.toHaveBeenCalled()
  })

  it('replaces edit child state through one atomic batchUpdate', async () => {
    const existing: StoredSubmission = {
      submissionId: 'SUP-EXISTING',
      namaDistributor: 'DISTRIBUTOR',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      wilayah: [
        {
          submissionAreaId: 'AREA-OLD',
          provinsiName: 'ACEH',
          areaName: 'Area 02',
          supervisors: [{
            supervisorId: 'SPV-OLD',
            namaSupervisor: 'Budi',
            ktp: {
              fileId: 'file_old_12345',
              fileName: 'KTP_OLD.pdf',
              fileUrl: 'https://drive.google.com/file/d/file_old_12345/view',
            },
          }],
        },
      ],
    }
    const editInput: ValidatedSubmission = {
      ...input,
      wilayah: [{
        ...input.wilayah[0]!,
        submissionAreaId: 'AREA-OLD',
        supervisors: [{
          ...input.wilayah[0]!.supervisors[0]!,
          supervisorId: 'SPV-OLD',
        }],
      }],
    }
    mocks.readSheetTable.mockImplementation(
      async (_id: string, sheet: string) => ({
        headers: headers(sheet),
        rows:
          sheet === 'submission'
            ? [{ rowNumber: 2, record: {
                submission_id: 'SUP-EXISTING',
                nama_distributor: 'DISTRIBUTOR',
                created_at: existing.createdAt,
                updated_at: existing.updatedAt,
              } }]
            : sheet === 'submission_area'
              ? [{ rowNumber: 2, record: {
                  submission_area_id: 'AREA-OLD',
                  submission_id: 'SUP-EXISTING',
                  provinsi_name: 'ACEH',
                  area_name: 'Area 02',
                  jumlah_supervisor: '1',
                } }]
              : [{ rowNumber: 2, record: {
                  supervisor_id: 'SPV-OLD',
                  submission_id: 'SUP-EXISTING',
                  submission_area_id: 'AREA-OLD',
                  supervisor_no: '1',
                  nama_supervisor: 'Budi',
                  ktp_file_id: 'file_old_12345',
                  ktp_file_name: 'KTP_OLD.pdf',
                  ktp_file_url: 'https://drive.google.com/file/d/file_old_12345/view',
                } }],
      }),
    )
    const result = await updateSubmission(editInput, existing)
    expect(result.submission.submissionId).toBe('SUP-EXISTING')
    expect(result.submission.createdAt).toBe(existing.createdAt)
    expect(mocks.executeSpreadsheetBatchUpdate).toHaveBeenCalledOnce()
    expect(mocks.executeSpreadsheetBatchUpdate.mock.calls[0]?.[0]).toBe(
      'submission-spreadsheet-id',
    )
    expect(mocks.appendTablesAtomically).not.toHaveBeenCalled()
  })
})
