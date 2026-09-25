import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValidatedSubmission } from './submissionValidation.js'
import type { PersistedSubmission } from './transactionTypes.js'
const mocks = vi.hoisted(() => ({ read: vi.fn(), ids: vi.fn(), batch: vi.fn() }))
vi.mock('./env.js', () => ({ getSubmissionSheetConfig: () => ({ spreadsheetId: 'file', submissionSheetName: 'submission', submissionAreaSheetName: 'submission_area', submissionSupervisorSheetName: 'submission_supervisor' }) }))
vi.mock('./sheets.js', () => ({
  readSheetTable: mocks.read, getSheetIdMap: mocks.ids, executeSpreadsheetBatchUpdate: mocks.batch,
  extendedCellValue: (value: string | number | undefined) => typeof value === 'number' ? { numberValue: value } : { stringValue: value ?? '' },
}))
import { persistSubmission, updateSubmission } from './transactions.js'

const headers = (sheet: string) => sheet === 'submission'
  ? ['submission_id', 'nama_distributor', 'created_at', 'updated_at']
  : sheet === 'submission_area'
    ? ['submission_area_id', 'submission_id', 'ap', 'jumlah_supervisor']
    : ['supervisor_id', 'submission_id', 'submission_area_id', 'nama_distributor', 'ap', 'id_mdxl', 'supervisor_no', 'nama_supervisor', 'ktp_file_id', 'ktp_file_name', 'ktp_file_url', 'provinsi', 'area']
const input = (ap = 'AP1'): ValidatedSubmission => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000', distributor: { namaDistributor: 'VENDOR' }, ap: { ap },
  supervisors: [{ idMdxl: '1001', namaSupervisor: 'BASE', ktpSource: 'not-required' }],
})
describe('Phase 7 transaction routing', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.ids.mockResolvedValue(new Map([['submission', 1], ['submission_area', 2], ['submission_supervisor', 3]])); mocks.batch.mockResolvedValue(undefined)
    mocks.read.mockImplementation(async (_id: string, sheet: string) => ({ headers: headers(sheet), rows: sheet === 'submission_supervisor' ? [{ rowNumber: 2, record: { supervisor_id: '', submission_id: '', submission_area_id: '', nama_distributor: 'VENDOR', ap: 'AP1', id_mdxl: '1001' } }] : [] }))
  })
  it('first save deletes matching blank baseline and appends all rows in one atomic batch', async () => {
    await persistSubmission(input())
    expect(mocks.batch).toHaveBeenCalledOnce()
    const requests = mocks.batch.mock.calls[0]?.[1] as Array<Record<string, unknown>>
    expect(requests[0]).toHaveProperty('deleteDimension'); expect(requests.filter((item) => 'appendCells' in item)).toHaveLength(3)
    const supervisorAppend = requests.at(-1) as { appendCells: { rows: Array<{ values: unknown[] }> } }
    expect(supervisorAppend.appendCells.rows[0]?.values.slice(-2)).toEqual([{}, {}])
  })
  it('allows a second AP but rejects duplicate Distributor + AP', async () => {
    mocks.read.mockImplementation(async (_id: string, sheet: string) => ({ headers: headers(sheet), rows: sheet === 'submission' ? [{ rowNumber: 2, record: { submission_id: 'SUP-OLD', nama_distributor: 'VENDOR', created_at: 'x', updated_at: 'x' } }] : sheet === 'submission_area' ? [{ rowNumber: 2, record: { submission_area_id: 'AREA-OLD', submission_id: 'SUP-OLD', ap: 'AP1' } }] : [] }))
    await expect(persistSubmission(input('AP2'))).resolves.toMatchObject({ mode: 'create' })
    await expect(persistSubmission(input('AP1'))).rejects.toMatchObject({ code: 'SUBMISSION_CONFLICT' })
  })
  it('edit preserves parent and replaces child rows atomically', async () => {
    const existing: PersistedSubmission = { submissionId: 'SUP-OLD', submissionAreaId: 'AREA-OLD', namaDistributor: 'VENDOR', ap: 'AP1', createdAt: '2026-01-01', updatedAt: '2026-01-02', supervisors: [{ supervisorId: 'SPV-1', idMdxl: '1001', namaSupervisor: 'BASE' }] }
    const value = input(); value.submissionAreaId = 'AREA-OLD'; value.supervisors[0]!.supervisorId = 'SPV-1'
    mocks.read.mockImplementation(async (_id: string, sheet: string) => ({ headers: headers(sheet), rows: sheet === 'submission' ? [{ rowNumber: 2, record: { submission_id: 'SUP-OLD', nama_distributor: 'VENDOR', created_at: existing.createdAt, updated_at: existing.updatedAt } }] : sheet === 'submission_area' ? [{ rowNumber: 2, record: { submission_area_id: 'AREA-OLD', submission_id: 'SUP-OLD', ap: 'AP1' } }] : [{ rowNumber: 2, record: { supervisor_id: 'SPV-1', submission_id: 'SUP-OLD', submission_area_id: 'AREA-OLD', id_mdxl: '1001', supervisor_no: '1', nama_supervisor: 'BASE' } }] }))
    await expect(updateSubmission(value, existing)).resolves.toMatchObject({ submission: { submissionId: 'SUP-OLD', mode: 'edit' } })
    expect(mocks.batch).toHaveBeenCalledOnce()
  })
})
