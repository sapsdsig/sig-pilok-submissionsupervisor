import { describe, expect, it, vi } from 'vitest'
import type { SupervisorMasterRow } from '../../src/types/masterData.js'
import { buildBaselineImportPlan, extractSavedCombinations, mapMasterToBaseline, runBaselineImport } from './baselineImport.js'
import type { SheetTable } from './sheets.js'

const master: SupervisorMasterRow[] = [
  { vendorName: 'VENDOR A', ap: 'AP1', fullname: 'ANI', idMdxl: '1001' },
  { vendorName: 'VENDOR A', ap: 'AP1', fullname: 'BUDI', idMdxl: '1002' },
  { vendorName: 'VENDOR A', ap: 'AP2', fullname: 'CICI', idMdxl: '1003' },
]
const table = (rows: SheetTable['rows'] = []): SheetTable => ({ headers: [], rows })

describe('Q2 baseline import', () => {
  it('maps master identity with blank transaction and KTP fields', () => {
    expect(mapMasterToBaseline(master[0]!)).toEqual({
      supervisor_id: '', submission_id: '', submission_area_id: '', nama_distributor: 'VENDOR A', ap: 'AP1', id_mdxl: '1001', supervisor_no: '', nama_supervisor: 'ANI', ktp_file_id: '', ktp_file_name: '', ktp_file_url: '',
    })
  })
  it('is idempotent and skips saved Distributor + AP combinations', () => {
    const plan = buildBaselineImportPlan(master, table([
      { rowNumber: 2, record: { submission_id: '', nama_distributor: 'VENDOR A', ap: 'AP2', id_mdxl: '1003' } },
      { rowNumber: 3, record: { submission_id: 'SUP-1', nama_distributor: 'VENDOR A', ap: 'AP1', id_mdxl: '1001' } },
    ]))
    expect(plan.records).toHaveLength(0); expect(plan.skippedSavedCombination).toBe(2); expect(plan.alreadyPresent).toBe(1)
  })
  it('dry-run writes nothing while explicit apply writes intended rows only', async () => {
    const write = vi.fn(async () => undefined)
    await runBaselineImport({ masterRows: master, supervisorTable: table(), apply: false, write })
    expect(write).not.toHaveBeenCalled()
    await runBaselineImport({ masterRows: master, supervisorTable: table(), apply: true, write })
    expect(write).toHaveBeenCalledOnce(); expect(write).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id_mdxl: '1001' })]))
  })
  it('derives saved combinations from parent + AP and rejects ambiguous legacy parents', () => {
    const parents = table([{ rowNumber: 2, record: { submission_id: 'SUP-1', nama_distributor: 'VENDOR A' } }])
    expect(extractSavedCombinations(parents, table([{ rowNumber: 2, record: { submission_id: 'SUP-1', ap: 'AP1' } }]))).toEqual([{ namaDistributor: 'VENDOR A', ap: 'AP1' }])
    expect(() => extractSavedCombinations(parents, table())).toThrow('Migrasi manual')
  })
})
