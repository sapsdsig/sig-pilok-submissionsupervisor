import { createHash, randomUUID } from 'node:crypto'
import type { sheets_v4 } from 'googleapis'
import type { StoredSubmission, StoredSupervisor, SubmissionLookupResponse, SubmissionResult } from '../../src/types/api.js'
import { getSubmissionSheetConfig } from './env.js'
import { ApiError } from './errors.js'
import { getCanonicalBaselineSupervisor, normalizeMasterName } from './masterData.js'
import { SUBMISSION_AREA_HEADERS, SUBMISSION_HEADERS, SUBMISSION_SUPERVISOR_HEADERS } from './sheetHeaders.js'
import { executeSpreadsheetBatchUpdate, extendedCellValue, getSheetIdMap, readSheetTable, type SheetTable, type WritableRecord } from './sheets.js'
import type { ValidatedSubmission } from './submissionValidation.js'
import { datePartFromRequestToken } from './requestToken.js'
import { formatWibTimestamp } from './timestamps.js'
import type { PersistedSubmission } from './transactionTypes.js'

export type TransactionRecords = {
  submissionId: string
  createdAt: string
  updatedAt: string
  submission: WritableRecord
  areas: WritableRecord[]
  supervisors: WritableRecord[]
}
export class SubmissionPersistenceError extends Error {
  constructor(public readonly writeAttempted: boolean, cause: unknown) {
    super('Google Sheets submission persistence failed.', { cause })
    this.name = 'SubmissionPersistenceError'
  }
}
export function createSubmissionId(requestToken: string): string {
  const digest = createHash('sha256').update(requestToken).digest('hex').slice(0, 12).toUpperCase()
  return `SUP-${datePartFromRequestToken(requestToken)}-${digest}`
}
const childId = (prefix: 'AREA' | 'SPV') => `${prefix}-${randomUUID().replaceAll('-', '').toUpperCase()}`

export function buildTransactionRecords(input: ValidatedSubmission, now = new Date(), existing?: PersistedSubmission): TransactionRecords {
  const updatedAt = formatWibTimestamp(now)
  const submissionId = existing?.submissionId ?? createSubmissionId(input.requestToken)
  const createdAt = existing?.createdAt ?? updatedAt
  const submissionAreaId = input.submissionAreaId ?? childId('AREA')
  const supervisors = input.supervisors.map((item, index) => ({
    supervisor_id: item.supervisorId ?? childId('SPV'),
    submission_id: submissionId,
    submission_area_id: submissionAreaId,
    nama_distributor: input.distributor.namaDistributor,
    ap: input.ap.ap,
    id_mdxl: item.idMdxl,
    supervisor_no: index + 1,
    nama_supervisor: item.namaSupervisor,
    ktp_file_id: item.ktp?.fileId ?? '',
    ktp_file_name: item.ktp?.fileName ?? '',
    ktp_file_url: item.ktp?.fileUrl ?? '',
  }))
  return {
    submissionId, createdAt, updatedAt,
    submission: { submission_id: submissionId, nama_distributor: input.distributor.namaDistributor, created_at: createdAt, updated_at: updatedAt },
    areas: [{ submission_area_id: submissionAreaId, submission_id: submissionId, ap: input.ap.ap, jumlah_supervisor: supervisors.length }],
    supervisors,
  }
}

async function readTransactionTables() {
  const config = getSubmissionSheetConfig()
  const [submissionTable, areaTable, supervisorTable] = await Promise.all([
    readSheetTable(config.spreadsheetId, config.submissionSheetName, SUBMISSION_HEADERS),
    readSheetTable(config.spreadsheetId, config.submissionAreaSheetName, SUBMISSION_AREA_HEADERS),
    readSheetTable(config.spreadsheetId, config.submissionSupervisorSheetName, SUBMISSION_SUPERVISOR_HEADERS),
  ])
  return { config, submissionTable, areaTable, supervisorTable }
}

function reconstructSubmission(parent: SheetTable['rows'][number], areaTable: SheetTable, supervisorTable: SheetTable): PersistedSubmission {
  const submissionId = parent.record.submission_id ?? ''
  const areas = areaTable.rows.filter((row) => row.record.submission_id === submissionId)
  if (areas.length !== 1 || !areas[0]?.record.submission_area_id || !areas[0]?.record.ap) {
    throw new ApiError(409, 'LEGACY_SUBMISSION_REQUIRES_MIGRATION', 'Submission tersimpan belum memiliki satu AP yang valid. Lakukan migrasi manual sebelum mengedit.')
  }
  const area = areas[0]
  const submissionAreaId = area.record.submission_area_id ?? ''
  const supervisorRows = supervisorTable.rows.filter((row) => row.record.submission_id === submissionId)
  const ids = supervisorRows.map((row) => row.record.supervisor_id ?? '')
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Data Supervisor tersimpan memiliki identitas yang tidak valid.')
  return {
    submissionId, submissionAreaId,
    namaDistributor: parent.record.nama_distributor ?? '', ap: area.record.ap ?? '',
    createdAt: parent.record.created_at ?? '', updatedAt: parent.record.updated_at ?? '',
    supervisors: supervisorRows.filter((row) => row.record.submission_area_id === submissionAreaId)
      .sort((a, b) => Number(a.record.supervisor_no) - Number(b.record.supervisor_no) || a.rowNumber - b.rowNumber)
      .map((row) => {
        const idMdxl = row.record.id_mdxl ?? ''
        const fileId = row.record.ktp_file_id ?? ''
        const fileName = row.record.ktp_file_name ?? ''
        const fileUrl = row.record.ktp_file_url ?? ''
        if (!idMdxl && (!fileId || !fileName || !fileUrl)) {
          throw new ApiError(409, 'SUBMISSION_CONFLICT', `Supervisor custom tersimpan pada baris ${row.rowNumber} tidak memiliki metadata KTP lengkap.`)
        }
        return {
          supervisorId: row.record.supervisor_id ?? '', idMdxl,
          namaSupervisor: row.record.nama_supervisor ?? '',
          ktp: idMdxl ? undefined : { fileId, fileName, fileUrl },
        }
      }),
  }
}

export function toStoredSubmissionResponse(value: PersistedSubmission): StoredSubmission {
  return {
    submissionId: value.submissionId, submissionAreaId: value.submissionAreaId,
    namaDistributor: value.namaDistributor, ap: value.ap, createdAt: value.createdAt, updatedAt: value.updatedAt,
    supervisors: value.supervisors.map((item) => ({
      supervisorId: item.supervisorId, idMdxl: item.idMdxl || undefined,
      source: item.idMdxl ? 'baseline' : 'custom', namaSupervisor: item.namaSupervisor,
      ktp: item.idMdxl ? { kind: 'not-required' } : { kind: 'existing' },
    })),
  }
}

function parentsForDistributor(tables: Awaited<ReturnType<typeof readTransactionTables>>, namaDistributor: string) {
  const key = normalizeMasterName(namaDistributor)
  return tables.submissionTable.rows.filter((row) => normalizeMasterName(row.record.nama_distributor ?? '') === key)
}

function findPersistedByIdentity(tables: Awaited<ReturnType<typeof readTransactionTables>>, namaDistributor: string, ap: string): PersistedSubmission | null {
  const apKey = normalizeMasterName(ap)
  const values = parentsForDistributor(tables, namaDistributor).map((parent) => reconstructSubmission(parent, tables.areaTable, tables.supervisorTable))
  const matches = values.filter((item) => normalizeMasterName(item.ap) === apKey)
  if (matches.length > 1) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Lebih dari satu submission ditemukan untuk Distributor + AP ini.')
  return matches[0] ?? null
}

export async function findSubmissionState(namaDistributor: string, ap: string): Promise<SubmissionLookupResponse> {
  const tables = await readTransactionTables()
  const saved = findPersistedByIdentity(tables, namaDistributor, ap)
  if (saved) {
    for (const supervisor of saved.supervisors) {
      if (!supervisor.idMdxl) continue
      const canonical = await getCanonicalBaselineSupervisor({
        namaDistributor: saved.namaDistributor,
        ap: saved.ap,
        idMdxl: supervisor.idMdxl,
        namaSupervisor: supervisor.namaSupervisor,
      })
      supervisor.idMdxl = canonical.idMdxl
      supervisor.namaSupervisor = canonical.fullname
    }
    return { exists: true, source: 'submission', submission: toStoredSubmissionResponse(saved) }
  }
  const vendorKey = normalizeMasterName(namaDistributor)
  const apKey = normalizeMasterName(ap)
  const baselineRows = tables.supervisorTable.rows.filter((row) =>
    !(row.record.submission_id ?? '') && !(row.record.submission_area_id ?? '') && !(row.record.supervisor_id ?? '') &&
    normalizeMasterName(row.record.nama_distributor ?? '') === vendorKey && normalizeMasterName(row.record.ap ?? '') === apKey,
  )
  const supervisors: StoredSupervisor[] = await Promise.all(baselineRows.map(async (row) => {
    const master = await getCanonicalBaselineSupervisor({
      namaDistributor, ap,
      idMdxl: row.record.id_mdxl ?? '',
      namaSupervisor: row.record.nama_supervisor ?? '',
    })
    return { idMdxl: master.idMdxl, source: 'baseline' as const, namaSupervisor: master.fullname, ktp: { kind: 'not-required' as const } }
  }))
  if (new Set(supervisors.map((item) => normalizeMasterName(item.idMdxl ?? ''))).size !== supervisors.length) {
    throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Baseline Supervisor memiliki ID MDXL duplikat.')
  }
  return { exists: false, source: 'baseline', supervisors }
}

export async function getStoredSubmissionById(submissionId: string): Promise<PersistedSubmission> {
  const tables = await readTransactionTables()
  const matches = tables.submissionTable.rows.filter((row) => row.record.submission_id === submissionId)
  if (matches.length !== 1) throw new ApiError(matches.length ? 409 : 404, matches.length ? 'SUBMISSION_CONFLICT' : 'SUBMISSION_NOT_FOUND', matches.length ? 'Identitas submission duplikat pada penyimpanan.' : 'Submission tidak ditemukan.')
  return reconstructSubmission(matches[0]!, tables.areaTable, tables.supervisorTable)
}

export async function hasStoredSubmission(requestToken: string, now = new Date()): Promise<SubmissionResult | null> {
  const config = getSubmissionSheetConfig()
  const expectedId = createSubmissionId(requestToken)
  const table = await readSheetTable(config.spreadsheetId, config.submissionSheetName, SUBMISSION_HEADERS)
  const row = table.rows.find((item) => item.record.submission_id === expectedId)
  if (!row) return null
  const createdAt = row.record.created_at || formatWibTimestamp(now)
  return { submissionId: expectedId, createdAt, updatedAt: row.record.updated_at || createdAt, mode: 'create' }
}

export async function referencedFileIds(fileIds: readonly string[]): Promise<Set<string>> {
  if (!fileIds.length) return new Set()
  const config = getSubmissionSheetConfig()
  const table = await readSheetTable(config.spreadsheetId, config.submissionSupervisorSheetName, SUBMISSION_SUPERVISOR_HEADERS)
  const candidates = new Set(fileIds)
  return new Set(table.rows.map((row) => row.record.ktp_file_id ?? '').filter((id) => candidates.has(id)))
}

function appendRequest(sheetId: number, headers: readonly string[], records: readonly WritableRecord[]): sheets_v4.Schema$Request {
  return { appendCells: { sheetId, fields: 'userEnteredValue', rows: records.map((record) => ({
    values: headers.map((header) => Object.prototype.hasOwnProperty.call(record, header)
      ? { userEnteredValue: extendedCellValue(record[header]) }
      : {}),
  })) } }
}
function deleteRowsRequests(sheetId: number, rows: readonly number[]): sheets_v4.Schema$Request[] {
  return [...rows].sort((a, b) => b - a).map((row) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }))
}
function parentUpdates(sheetId: number, rowNumber: number, headers: readonly string[], record: WritableRecord): sheets_v4.Schema$Request[] {
  return SUBMISSION_HEADERS.map((header) => {
    const columnIndex = headers.indexOf(header)
    if (columnIndex < 0) throw new ApiError(500, 'GOOGLE_CONFIG_ERROR', `Header submission tidak ditemukan: ${header}.`)
    return { updateCells: { range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }, rows: [{ values: [{ userEnteredValue: extendedCellValue(record[header]) }] }], fields: 'userEnteredValue' } }
  })
}

export async function persistSubmission(input: ValidatedSubmission): Promise<SubmissionResult> {
  let tables: Awaited<ReturnType<typeof readTransactionTables>>
  try { tables = await readTransactionTables() } catch (error) { throw new SubmissionPersistenceError(false, error) }
  if (findPersistedByIdentity(tables, input.distributor.namaDistributor, input.ap.ap)) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Data Distributor + AP sudah tersedia. Muat data tersimpan lalu gunakan Mode Edit.')
  const records = buildTransactionRecords(input)
  const names = [tables.config.submissionSheetName, tables.config.submissionAreaSheetName, tables.config.submissionSupervisorSheetName] as const
  const ids = await getSheetIdMap(tables.config.spreadsheetId, names)
  const supervisorSheetId = ids.get(tables.config.submissionSupervisorSheetName)!
  const vendorKey = normalizeMasterName(input.distributor.namaDistributor)
  const apKey = normalizeMasterName(input.ap.ap)
  const baselineRows = tables.supervisorTable.rows.filter((row) =>
    !(row.record.submission_id ?? '') && !(row.record.submission_area_id ?? '') && !(row.record.supervisor_id ?? '') &&
    normalizeMasterName(row.record.nama_distributor ?? '') === vendorKey && normalizeMasterName(row.record.ap ?? '') === apKey,
  ).map((row) => row.rowNumber)
  const requests: sheets_v4.Schema$Request[] = [
    ...deleteRowsRequests(supervisorSheetId, baselineRows),
    appendRequest(ids.get(tables.config.submissionSheetName)!, tables.submissionTable.headers, [records.submission]),
    appendRequest(ids.get(tables.config.submissionAreaSheetName)!, tables.areaTable.headers, records.areas),
    appendRequest(supervisorSheetId, tables.supervisorTable.headers, records.supervisors),
  ]
  try { await executeSpreadsheetBatchUpdate(tables.config.spreadsheetId, requests) } catch (error) {
    try { const stored = await hasStoredSubmission(input.requestToken); if (stored) return stored } catch { /* ambiguous */ }
    throw new SubmissionPersistenceError(true, error)
  }
  return { submissionId: records.submissionId, createdAt: records.createdAt, updatedAt: records.updatedAt, mode: 'create' }
}

export function deriveOldFileIdsToCleanup(existing: PersistedSubmission, records: TransactionRecords): string[] {
  const next = new Set(records.supervisors.map((item) => String(item.ktp_file_id)).filter(Boolean))
  return existing.supervisors.flatMap((item) => item.ktp?.fileId ? [item.ktp.fileId] : []).filter((id) => !next.has(id))
}

function recordsMatchStored(stored: PersistedSubmission, records: TransactionRecords): boolean {
  return stored.submissionId === records.submissionId &&
    stored.updatedAt === records.updatedAt &&
    stored.ap === String(records.areas[0]?.ap ?? '') &&
    JSON.stringify(stored.supervisors.map((item) => ({ id: item.supervisorId, mdxl: item.idMdxl, name: item.namaSupervisor, file: item.ktp?.fileId ?? '' }))) ===
      JSON.stringify(records.supervisors.map((item) => ({ id: String(item.supervisor_id), mdxl: String(item.id_mdxl), name: String(item.nama_supervisor), file: String(item.ktp_file_id) })))
}

export async function updateSubmission(input: ValidatedSubmission, expectedExisting: PersistedSubmission, now = new Date()): Promise<{ submission: SubmissionResult; oldFileIdsToCleanup: string[] }> {
  let tables: Awaited<ReturnType<typeof readTransactionTables>>
  try { tables = await readTransactionTables() } catch (error) { throw new SubmissionPersistenceError(false, error) }
  const parents = tables.submissionTable.rows.filter((row) => row.record.submission_id === expectedExisting.submissionId)
  if (parents.length !== 1) throw new ApiError(parents.length ? 409 : 404, parents.length ? 'SUBMISSION_CONFLICT' : 'SUBMISSION_NOT_FOUND', parents.length ? 'Identitas submission duplikat.' : 'Submission tidak ditemukan.')
  const current = reconstructSubmission(parents[0]!, tables.areaTable, tables.supervisorTable)
  const identityOwner = findPersistedByIdentity(tables, input.distributor.namaDistributor, input.ap.ap)
  if (!identityOwner || identityOwner.submissionId !== current.submissionId) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Identitas Distributor + AP tidak cocok dengan submission ini.')
  if (normalizeMasterName(current.namaDistributor) !== normalizeMasterName(input.distributor.namaDistributor) || normalizeMasterName(current.ap) !== normalizeMasterName(input.ap.ap)) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Submission tidak dimiliki Distributor + AP ini.')
  const records = buildTransactionRecords(input, now, current)
  const names = [tables.config.submissionSheetName, tables.config.submissionAreaSheetName, tables.config.submissionSupervisorSheetName] as const
  const ids = await getSheetIdMap(tables.config.spreadsheetId, names)
  const oldFileIdsToCleanup = deriveOldFileIdsToCleanup(current, records)
  const requests: sheets_v4.Schema$Request[] = [
    ...parentUpdates(ids.get(tables.config.submissionSheetName)!, parents[0]!.rowNumber, tables.submissionTable.headers, records.submission),
    ...deleteRowsRequests(ids.get(tables.config.submissionSupervisorSheetName)!, tables.supervisorTable.rows.filter((row) => row.record.submission_id === records.submissionId).map((row) => row.rowNumber)),
    ...deleteRowsRequests(ids.get(tables.config.submissionAreaSheetName)!, tables.areaTable.rows.filter((row) => row.record.submission_id === records.submissionId).map((row) => row.rowNumber)),
    appendRequest(ids.get(tables.config.submissionAreaSheetName)!, tables.areaTable.headers, records.areas),
    appendRequest(ids.get(tables.config.submissionSupervisorSheetName)!, tables.supervisorTable.headers, records.supervisors),
  ]
  try { await executeSpreadsheetBatchUpdate(tables.config.spreadsheetId, requests) } catch (error) {
    try {
      const stored = await getStoredSubmissionById(records.submissionId)
      if (recordsMatchStored(stored, records)) return { submission: { submissionId: records.submissionId, createdAt: records.createdAt, updatedAt: records.updatedAt, mode: 'edit' }, oldFileIdsToCleanup }
    } catch { /* preserve old and new KTP files when outcome is ambiguous */ }
    throw new SubmissionPersistenceError(true, error)
  }
  return { submission: { submissionId: records.submissionId, createdAt: records.createdAt, updatedAt: records.updatedAt, mode: 'edit' }, oldFileIdsToCleanup }
}
