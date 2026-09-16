import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValidatedSubmission } from './submissionValidation.js'

const mocks = vi.hoisted(() => ({
  readSheetTable: vi.fn(),
  getSheetIdMap: vi.fn(),
  appendTablesAtomically: vi.fn(),
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
}))

import { persistSubmission } from './transactions.js'

const input: ValidatedSubmission = {
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
  distributor: {
    kodeDistributor: '0000000971',
    namaDistributor: 'DISTRIBUTOR',
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
      ],
    },
  ],
}

describe('transaction spreadsheet routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readSheetTable.mockImplementation(
      async (_spreadsheetId: string, sheetName: string) => ({
        headers:
          sheetName === 'submission'
            ? ['submission_id', 'kode_distributor', 'nama_distributor', 'created_at', 'updated_at']
            : sheetName === 'submission_area'
              ? ['submission_area_id', 'submission_id']
              : ['supervisor_id', 'submission_id'],
        rows: [],
      }),
    )
    mocks.getSheetIdMap.mockResolvedValue(
      new Map([
        ['submission', 1],
        ['submission_area', 2],
        ['submission_supervisor', 3],
      ]),
    )
    mocks.appendTablesAtomically.mockResolvedValue(undefined)
  })

  it('membaca dan menulis ketiga tab hanya pada submission spreadsheet', async () => {
    await persistSubmission(input)

    expect(mocks.readSheetTable).toHaveBeenCalledTimes(3)
    for (const call of mocks.readSheetTable.mock.calls) {
      expect(call[0]).toBe('submission-spreadsheet-id')
    }
    expect(mocks.getSheetIdMap).toHaveBeenCalledWith(
      'submission-spreadsheet-id',
      ['submission', 'submission_area', 'submission_supervisor'],
    )
    expect(mocks.appendTablesAtomically).toHaveBeenCalledTimes(1)
    expect(mocks.appendTablesAtomically.mock.calls[0]?.[0]).toBe(
      'submission-spreadsheet-id',
    )
    expect(mocks.appendTablesAtomically.mock.calls[0]?.[1]).toHaveLength(3)
  })
})
