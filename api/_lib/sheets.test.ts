import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ batchUpdate: vi.fn() }))

vi.mock('googleapis', () => ({
  google: {
    sheets: () => ({
      spreadsheets: { batchUpdate: mocks.batchUpdate },
    }),
  },
}))

vi.mock('./googleAuth.js', () => ({ getGoogleAuth: vi.fn() }))

import { appendTablesAtomically } from './sheets.js'

describe('atomic transaction batch', () => {
  beforeEach(() => mocks.batchUpdate.mockReset())

  it('mengirim semua append dalam satu request ke submission spreadsheet', async () => {
    mocks.batchUpdate.mockResolvedValue({})
    await appendTablesAtomically('submission-spreadsheet-id', [
      {
        sheetName: 'submission',
        sheetId: 1,
        headers: ['submission_id'],
        records: [{ submission_id: 'SUP-1' }],
      },
      {
        sheetName: 'submission_area',
        sheetId: 2,
        headers: ['submission_id'],
        records: [{ submission_id: 'SUP-1' }],
      },
      {
        sheetName: 'submission_supervisor',
        sheetId: 3,
        headers: ['submission_id'],
        records: [{ submission_id: 'SUP-1' }],
      },
    ])

    expect(mocks.batchUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'submission-spreadsheet-id',
        requestBody: {
          requests: expect.arrayContaining([
            expect.objectContaining({ appendCells: expect.objectContaining({ sheetId: 1 }) }),
            expect.objectContaining({ appendCells: expect.objectContaining({ sheetId: 2 }) }),
            expect.objectContaining({ appendCells: expect.objectContaining({ sheetId: 3 }) }),
          ]),
        },
      }),
    )
  })
})
