import { beforeEach, describe, expect, it, vi } from 'vitest'
const read = vi.hoisted(() => vi.fn())
vi.mock('./env.js', () => ({ getSubmissionSheetConfig: () => ({ spreadsheetId: 'file', submissionSheetName: 'submission', submissionAreaSheetName: 'submission_area', submissionSupervisorSheetName: 'submission_supervisor' }) }))
vi.mock('./sheets.js', () => ({ readSheetTable: read }))
vi.mock('./masterData.js', () => ({
  normalizeMasterName: (value: string) => value.trim().toUpperCase(),
  getCanonicalBaselineSupervisor: async (input: { namaDistributor: string; ap: string; idMdxl: string; namaSupervisor: string }) => ({ vendorName: input.namaDistributor, ap: input.ap, idMdxl: input.idMdxl, fullname: input.namaSupervisor }),
}))
import { findSubmissionState, getStoredSubmissionById } from './transactions.js'

const tables = (sheet: string, saved = false, duplicates = false) => ({ headers: [], rows:
  sheet === 'submission' ? (saved ? Array.from({ length: duplicates ? 2 : 1 }, (_, index) => ({ rowNumber: index + 2, record: { submission_id: `SUP-${index}`, nama_distributor: 'VENDOR', created_at: '2026-01-01', updated_at: '2026-01-02' } })) : []) :
  sheet === 'submission_area' ? (saved ? Array.from({ length: duplicates ? 2 : 1 }, (_, index) => ({ rowNumber: index + 2, record: { submission_area_id: `AREA-${index}`, submission_id: `SUP-${index}`, ap: 'AP1' } })) : []) :
  saved ? [{ rowNumber: 2, record: { supervisor_id: 'SPV-1', submission_id: 'SUP-0', submission_area_id: 'AREA-0', nama_distributor: 'VENDOR', ap: 'AP1', id_mdxl: '', supervisor_no: '1', nama_supervisor: 'CUSTOM', ktp_file_id: 'file_123456789', ktp_file_name: 'KTP.pdf', ktp_file_url: 'https://drive.google.com/x' } }] :
    [{ rowNumber: 2, record: { supervisor_id: '', submission_id: '', submission_area_id: '', nama_distributor: 'VENDOR', ap: 'AP1', id_mdxl: '1001', supervisor_no: '', nama_supervisor: 'BASE', ktp_file_id: '', ktp_file_name: '', ktp_file_url: '' } }]
})
describe('Phase 7 load source', () => {
  beforeEach(() => vi.clearAllMocks())
  it('loads baseline only when no saved submission exists', async () => {
    read.mockImplementation(async (_id: string, sheet: string) => tables(sheet, false))
    await expect(findSubmissionState('VENDOR', 'AP1')).resolves.toMatchObject({ exists: false, source: 'baseline', supervisors: [{ idMdxl: '1001' }] })
  })
  it('loads saved state and exposes no KTP metadata', async () => {
    read.mockImplementation(async (_id: string, sheet: string) => tables(sheet, true))
    const result = await findSubmissionState('VENDOR', 'AP1'); expect(result).toMatchObject({ exists: true, source: 'submission' })
    expect(JSON.stringify(result)).not.toMatch(/file_123|drive\.google|KTP\.pdf/)
    await expect(getStoredSubmissionById('SUP-0')).resolves.toMatchObject({ supervisors: [{ ktp: { fileId: 'file_123456789' } }] })
  })
  it('reports duplicate saved identities', async () => {
    read.mockImplementation(async (_id: string, sheet: string) => tables(sheet, true, true))
    await expect(findSubmissionState('VENDOR', 'AP1')).rejects.toMatchObject({ code: 'SUBMISSION_CONFLICT' })
  })
  it('does not fall back when reads fail', async () => {
    read.mockRejectedValue(new Error('network'))
    await expect(findSubmissionState('VENDOR', 'AP1')).rejects.toThrow('network')
  })
})
