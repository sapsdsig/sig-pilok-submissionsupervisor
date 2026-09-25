import type { SupervisorMasterRow } from '../../src/types/masterData.js'
import { normalizeMasterName } from './masterData.js'
import type { SheetTable, WritableRecord } from './sheets.js'

const pairKey = (vendor: string, ap: string) => `${normalizeMasterName(vendor)}::${normalizeMasterName(ap)}`
const identityKey = (vendor: string, ap: string, idMdxl: string) => `${pairKey(vendor, ap)}::${normalizeMasterName(idMdxl)}`

export function mapMasterToBaseline(row: SupervisorMasterRow): WritableRecord {
  return {
    supervisor_id: '', submission_id: '', submission_area_id: '',
    nama_distributor: row.vendorName, ap: row.ap, id_mdxl: row.idMdxl,
    supervisor_no: '', nama_supervisor: row.fullname,
    ktp_file_id: '', ktp_file_name: '', ktp_file_url: '',
  }
}

export type BaselineImportPlan = {
  masterRows: number
  eligibleRows: number
  alreadyPresent: number
  skippedSavedCombination: number
  records: WritableRecord[]
}

export type SavedCombination = { namaDistributor: string; ap: string }

export function extractSavedCombinations(
  submissionTable: SheetTable,
  areaTable: SheetTable,
): SavedCombination[] {
  return submissionTable.rows.map((parent) => {
    const submissionId = parent.record.submission_id ?? ''
    const areas = areaTable.rows.filter((row) => row.record.submission_id === submissionId)
    if (areas.length !== 1 || !areas[0]?.record.ap) {
      throw new Error(`Submission ${submissionId || `(baris ${parent.rowNumber})`} belum memiliki tepat satu AP. Migrasi manual diperlukan sebelum import baseline.`)
    }
    return {
      namaDistributor: parent.record.nama_distributor ?? '',
      ap: areas[0].record.ap ?? '',
    }
  })
}

export function buildBaselineImportPlan(masterRows: readonly SupervisorMasterRow[], supervisorTable: SheetTable, savedCombinations: readonly SavedCombination[] = []): BaselineImportPlan {
  const savedPairs = new Set([
    ...savedCombinations.map((item) => pairKey(item.namaDistributor, item.ap)),
    ...supervisorTable.rows.filter((row) => Boolean(row.record.submission_id)).map((row) => pairKey(row.record.nama_distributor ?? '', row.record.ap ?? '')),
  ])
  const existing = new Set(supervisorTable.rows.filter((row) => !row.record.submission_id && row.record.id_mdxl).map((row) => identityKey(row.record.nama_distributor ?? '', row.record.ap ?? '', row.record.id_mdxl ?? '')))
  const records: WritableRecord[] = []
  let alreadyPresent = 0
  let skippedSavedCombination = 0
  for (const row of masterRows) {
    if (savedPairs.has(pairKey(row.vendorName, row.ap))) { skippedSavedCombination += 1; continue }
    const identity = identityKey(row.vendorName, row.ap, row.idMdxl)
    if (existing.has(identity)) { alreadyPresent += 1; continue }
    existing.add(identity)
    records.push(mapMasterToBaseline(row))
  }
  return { masterRows: masterRows.length, eligibleRows: masterRows.length - skippedSavedCombination, alreadyPresent, skippedSavedCombination, records }
}

export async function runBaselineImport(input: {
  masterRows: readonly SupervisorMasterRow[]
  supervisorTable: SheetTable
  savedCombinations?: readonly SavedCombination[]
  apply: boolean
  write: (records: readonly WritableRecord[]) => Promise<void>
}): Promise<BaselineImportPlan> {
  const plan = buildBaselineImportPlan(input.masterRows, input.supervisorTable, input.savedCombinations)
  if (input.apply && plan.records.length) await input.write(plan.records)
  return plan
}
