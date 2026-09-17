import { createHash, randomUUID } from 'node:crypto'
import type { sheets_v4 } from 'googleapis'
import type {
  StoredSubmission,
  SubmissionResult,
} from '../../src/types/api.js'
import { getSubmissionSheetConfig } from './env.js'
import { ApiError } from './errors.js'
import { normalizeMasterName } from './masterData.js'
import {
  SUBMISSION_AREA_HEADERS,
  SUBMISSION_HEADERS,
  SUBMISSION_SUPERVISOR_HEADERS,
} from './sheetHeaders.js'
import {
  appendTablesAtomically,
  executeSpreadsheetBatchUpdate,
  extendedCellValue,
  getSheetIdMap,
  readSheetTable,
  type SheetTable,
  type WritableRecord,
} from './sheets.js'
import type { ValidatedSubmission } from './submissionValidation.js'
import { datePartFromRequestToken } from './requestToken.js'
import { formatWibTimestamp } from './timestamps.js'

export type TransactionRecords = {
  submissionId: string
  createdAt: string
  updatedAt: string
  submission: WritableRecord
  areas: WritableRecord[]
  supervisors: WritableRecord[]
}

export class SubmissionPersistenceError extends Error {
  constructor(
    public readonly writeAttempted: boolean,
    cause: unknown,
  ) {
    super('Google Sheets submission persistence failed.', { cause })
    this.name = 'SubmissionPersistenceError'
  }
}

export function createSubmissionId(requestToken: string): string {
  const date = datePartFromRequestToken(requestToken)
  const digest = createHash('sha256')
    .update(requestToken)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
  return `SUP-${date}-${digest}`
}

const createChildId = (prefix: 'AREA' | 'SPV') =>
  `${prefix}-${randomUUID().replaceAll('-', '').toUpperCase()}`

export function buildTransactionRecords(
  input: ValidatedSubmission,
  now = new Date(),
  existing?: StoredSubmission,
): TransactionRecords {
  const updatedAt = formatWibTimestamp(now)
  const submissionId = existing?.submissionId ?? createSubmissionId(input.requestToken)
  const createdAt = existing?.createdAt ?? updatedAt
  const areas: WritableRecord[] = []
  const supervisors: WritableRecord[] = []

  input.wilayah.forEach((wilayah) => {
    const submissionAreaId =
      wilayah.submissionAreaId ?? createChildId('AREA')
    areas.push({
      submission_area_id: submissionAreaId,
      submission_id: submissionId,
      provinsi_name: wilayah.province.provinsiName,
      area_name: wilayah.area.areaName,
      jumlah_supervisor: wilayah.supervisors.length,
    })

    wilayah.supervisors.forEach((supervisor, supervisorIndex) => {
      supervisors.push({
        supervisor_id: supervisor.supervisorId ?? createChildId('SPV'),
        submission_id: submissionId,
        submission_area_id: submissionAreaId,
        nama_distributor: input.distributor.namaDistributor,
        provinsi: wilayah.province.provinsiName,
        area: wilayah.area.areaName,
        supervisor_no: supervisorIndex + 1,
        nama_supervisor: supervisor.namaSupervisor,
        ktp_file_id: supervisor.ktp.fileId,
        ktp_file_name: supervisor.ktp.fileName,
        ktp_file_url: supervisor.ktp.fileUrl,
      })
    })
  })

  return {
    submissionId,
    createdAt,
    updatedAt,
    submission: {
      submission_id: submissionId,
      nama_distributor: input.distributor.namaDistributor,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    areas,
    supervisors,
  }
}

async function readTransactionTables() {
  const config = getSubmissionSheetConfig()
  const [submissionTable, areaTable, supervisorTable] = await Promise.all([
    readSheetTable(
      config.spreadsheetId,
      config.submissionSheetName,
      SUBMISSION_HEADERS,
    ),
    readSheetTable(
      config.spreadsheetId,
      config.submissionAreaSheetName,
      SUBMISSION_AREA_HEADERS,
    ),
    readSheetTable(
      config.spreadsheetId,
      config.submissionSupervisorSheetName,
      SUBMISSION_SUPERVISOR_HEADERS,
    ),
  ])
  return { config, submissionTable, areaTable, supervisorTable }
}

function reconstructSubmission(
  parent: SheetTable['rows'][number],
  areaTable: SheetTable,
  supervisorTable: SheetTable,
): StoredSubmission {
  const submissionId = parent.record.submission_id ?? ''
  const areaRows = areaTable.rows.filter(
    (row) => row.record.submission_id === submissionId,
  )
  const submissionAreaIds = areaRows.map(
    (row) => row.record.submission_area_id ?? '',
  )
  if (
    submissionAreaIds.some((id) => !id) ||
    new Set(submissionAreaIds).size !== submissionAreaIds.length
  ) {
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Data Wilayah tersimpan memiliki identitas yang tidak valid.',
    )
  }

  const supervisorRows = supervisorTable.rows.filter(
    (row) => row.record.submission_id === submissionId,
  )
  const supervisorIds = supervisorRows.map(
    (row) => row.record.supervisor_id ?? '',
  )
  if (
    supervisorIds.some((id) => !id) ||
    new Set(supervisorIds).size !== supervisorIds.length
  ) {
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Data Supervisor tersimpan memiliki identitas yang tidak valid.',
    )
  }

  return {
    submissionId,
    namaDistributor: parent.record.nama_distributor ?? '',
    createdAt: parent.record.created_at ?? '',
    updatedAt: parent.record.updated_at ?? '',
    wilayah: areaRows.map((areaRow) => {
      const submissionAreaId = areaRow.record.submission_area_id ?? ''
      const supervisors = supervisorRows
        .filter(
          (row) => row.record.submission_area_id === submissionAreaId,
        )
        .sort(
          (left, right) =>
            Number(left.record.supervisor_no) -
              Number(right.record.supervisor_no) ||
            left.rowNumber - right.rowNumber,
        )
        .map((row) => ({
          supervisorId: row.record.supervisor_id ?? '',
          namaSupervisor: row.record.nama_supervisor ?? '',
          ktp: {
            fileId: row.record.ktp_file_id ?? '',
            fileName: row.record.ktp_file_name ?? '',
            fileUrl: row.record.ktp_file_url ?? '',
          },
        }))
      return {
        submissionAreaId,
        provinsiName: areaRow.record.provinsi_name ?? '',
        areaName: areaRow.record.area_name ?? '',
        supervisors,
      }
    }),
  }
}

export async function findStoredSubmissionByDistributor(
  namaDistributor: string,
): Promise<StoredSubmission | null> {
  const { submissionTable, areaTable, supervisorTable } =
    await readTransactionTables()
  const key = normalizeMasterName(namaDistributor)
  const matches = submissionTable.rows.filter(
    (row) =>
      normalizeMasterName(row.record.nama_distributor ?? '') === key,
  )
  if (matches.length > 1) {
    console.error('Duplicate submission parents detected', {
      namaDistributor,
      count: matches.length,
    })
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Lebih dari satu submission ditemukan untuk Distributor ini. Hubungi administrator.',
    )
  }
  return matches[0]
    ? reconstructSubmission(matches[0], areaTable, supervisorTable)
    : null
}

export async function getStoredSubmissionById(
  submissionId: string,
): Promise<StoredSubmission> {
  const { submissionTable, areaTable, supervisorTable } =
    await readTransactionTables()
  const matches = submissionTable.rows.filter(
    (row) => row.record.submission_id === submissionId,
  )
  if (matches.length !== 1) {
    throw new ApiError(
      matches.length === 0 ? 404 : 409,
      matches.length === 0 ? 'SUBMISSION_NOT_FOUND' : 'SUBMISSION_CONFLICT',
      matches.length === 0
        ? 'Submission tidak ditemukan.'
        : 'Identitas submission duplikat pada penyimpanan.',
    )
  }
  return reconstructSubmission(matches[0]!, areaTable, supervisorTable)
}

export async function hasStoredSubmission(
  requestToken: string,
  now = new Date(),
): Promise<SubmissionResult | null> {
  const config = getSubmissionSheetConfig()
  const expectedId = createSubmissionId(requestToken)
  const table = await readSheetTable(
    config.spreadsheetId,
    config.submissionSheetName,
    SUBMISSION_HEADERS,
  )
  const row = table.rows.find(
    (candidate) => candidate.record.submission_id === expectedId,
  )
  if (!row) return null
  const createdAt = row.record.created_at || formatWibTimestamp(now)
  return {
    submissionId: expectedId,
    createdAt,
    updatedAt: row.record.updated_at || createdAt,
    mode: 'create',
  }
}

export async function referencedFileIds(
  fileIds: readonly string[],
): Promise<Set<string>> {
  if (fileIds.length === 0) return new Set()
  const config = getSubmissionSheetConfig()
  const table = await readSheetTable(
    config.spreadsheetId,
    config.submissionSupervisorSheetName,
    SUBMISSION_SUPERVISOR_HEADERS,
  )
  const candidates = new Set(fileIds)
  return new Set(
    table.rows
      .map((row) => row.record.ktp_file_id ?? '')
      .filter((fileId) => candidates.has(fileId)),
  )
}

export async function persistSubmission(
  input: ValidatedSubmission,
): Promise<SubmissionResult> {
  let tables: Awaited<ReturnType<typeof readTransactionTables>>
  try {
    tables = await readTransactionTables()
  } catch (error) {
    throw new SubmissionPersistenceError(false, error)
  }
  const duplicate = tables.submissionTable.rows.find(
    (row) =>
      normalizeMasterName(row.record.nama_distributor ?? '') ===
      normalizeMasterName(input.distributor.namaDistributor),
  )
  if (duplicate) {
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Data Distributor sudah tersedia. Muat data tersimpan lalu gunakan Mode Edit.',
    )
  }

  const records = buildTransactionRecords(input)
  const sheetNames = [
    tables.config.submissionSheetName,
    tables.config.submissionAreaSheetName,
    tables.config.submissionSupervisorSheetName,
  ] as const
  const sheetIds = await getSheetIdMap(
    tables.config.spreadsheetId,
    sheetNames,
  )
  try {
    await appendTablesAtomically(tables.config.spreadsheetId, [
      {
        sheetName: tables.config.submissionSheetName,
        sheetId: sheetIds.get(tables.config.submissionSheetName)!,
        headers: tables.submissionTable.headers,
        records: [records.submission],
      },
      {
        sheetName: tables.config.submissionAreaSheetName,
        sheetId: sheetIds.get(tables.config.submissionAreaSheetName)!,
        headers: tables.areaTable.headers,
        records: records.areas,
      },
      {
        sheetName: tables.config.submissionSupervisorSheetName,
        sheetId: sheetIds.get(tables.config.submissionSupervisorSheetName)!,
        headers: tables.supervisorTable.headers,
        records: records.supervisors,
      },
    ])
  } catch (error) {
    try {
      const stored = await hasStoredSubmission(input.requestToken)
      if (stored) return stored
    } catch {
      // Ambiguous state: caller must preserve uploads until references can be checked.
    }
    throw new SubmissionPersistenceError(true, error)
  }
  return {
    submissionId: records.submissionId,
    createdAt: records.createdAt,
    updatedAt: records.updatedAt,
    mode: 'create',
  }
}

function appendRequest(
  sheetId: number,
  headers: readonly string[],
  records: readonly WritableRecord[],
): sheets_v4.Schema$Request {
  return {
    appendCells: {
      sheetId,
      fields: 'userEnteredValue',
      rows: records.map((record) => ({
        values: headers.map((header) => ({
          userEnteredValue: extendedCellValue(record[header]),
        })),
      })),
    },
  }
}

function deleteRowsRequests(
  sheetId: number,
  rowNumbers: readonly number[],
): sheets_v4.Schema$Request[] {
  return [...rowNumbers]
    .sort((left, right) => right - left)
    .map((rowNumber) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    }))
}

function parentUpdateRequests(
  sheetId: number,
  rowNumber: number,
  headers: readonly string[],
  record: WritableRecord,
): sheets_v4.Schema$Request[] {
  return SUBMISSION_HEADERS.map((header) => {
    const columnIndex = headers.indexOf(header)
    if (columnIndex < 0) {
      throw new ApiError(
        500,
        'GOOGLE_CONFIG_ERROR',
        `Header submission tidak ditemukan: ${header}.`,
      )
    }
    return {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
        rows: [
          {
            values: [
              { userEnteredValue: extendedCellValue(record[header]) },
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    }
  })
}

function recordsMatchStored(
  stored: StoredSubmission,
  records: TransactionRecords,
): boolean {
  const actualAreas = stored.wilayah.map((area) => ({
    id: area.submissionAreaId,
    province: area.provinsiName,
    area: area.areaName,
    supervisors: area.supervisors.map((supervisor) => ({
      id: supervisor.supervisorId,
      name: supervisor.namaSupervisor,
      fileId: supervisor.ktp.fileId,
    })),
  }))
  const expectedAreas = records.areas.map((area) => ({
    id: String(area.submission_area_id),
    province: String(area.provinsi_name),
    area: String(area.area_name),
    supervisors: records.supervisors
      .filter(
        (supervisor) =>
          supervisor.submission_area_id === area.submission_area_id,
      )
      .map((supervisor) => ({
        id: String(supervisor.supervisor_id),
        name: String(supervisor.nama_supervisor),
        fileId: String(supervisor.ktp_file_id),
      })),
  }))
  return (
    stored.submissionId === records.submissionId &&
    stored.updatedAt === records.updatedAt &&
    JSON.stringify(actualAreas) === JSON.stringify(expectedAreas)
  )
}

export type UpdateSubmissionResult = {
  submission: SubmissionResult
  oldFileIdsToCleanup: string[]
}

export function deriveOldFileIdsToCleanup(
  existing: StoredSubmission,
  records: TransactionRecords,
): string[] {
  const newFileIds = new Set(
    records.supervisors.map((record) => String(record.ktp_file_id)),
  )
  return existing.wilayah
    .flatMap((area) =>
      area.supervisors.map((supervisor) => supervisor.ktp.fileId),
    )
    .filter((fileId) => !newFileIds.has(fileId))
}

export async function updateSubmission(
  input: ValidatedSubmission,
  expectedExisting: StoredSubmission,
  now = new Date(),
): Promise<UpdateSubmissionResult> {
  let tables: Awaited<ReturnType<typeof readTransactionTables>>
  try {
    tables = await readTransactionTables()
  } catch (error) {
    throw new SubmissionPersistenceError(false, error)
  }
  const parents = tables.submissionTable.rows.filter(
    (row) => row.record.submission_id === expectedExisting.submissionId,
  )
  if (parents.length !== 1) {
    throw new ApiError(
      parents.length === 0 ? 404 : 409,
      parents.length === 0 ? 'SUBMISSION_NOT_FOUND' : 'SUBMISSION_CONFLICT',
      parents.length === 0
        ? 'Submission tidak ditemukan.'
        : 'Identitas submission duplikat pada penyimpanan.',
    )
  }
  const current = reconstructSubmission(
    parents[0]!,
    tables.areaTable,
    tables.supervisorTable,
  )
  if (
    normalizeMasterName(current.namaDistributor) !==
    normalizeMasterName(input.distributor.namaDistributor)
  ) {
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Submission tidak dimiliki oleh Distributor yang dipilih.',
    )
  }

  const records = buildTransactionRecords(input, now, current)
  const sheetNames = [
    tables.config.submissionSheetName,
    tables.config.submissionAreaSheetName,
    tables.config.submissionSupervisorSheetName,
  ] as const
  const sheetIds = await getSheetIdMap(
    tables.config.spreadsheetId,
    sheetNames,
  )
  const submissionSheetId = sheetIds.get(tables.config.submissionSheetName)!
  const areaSheetId = sheetIds.get(tables.config.submissionAreaSheetName)!
  const supervisorSheetId = sheetIds.get(
    tables.config.submissionSupervisorSheetName,
  )!
  const oldFileIdsToCleanup = deriveOldFileIdsToCleanup(current, records)
  const areaRows = tables.areaTable.rows
    .filter((row) => row.record.submission_id === records.submissionId)
    .map((row) => row.rowNumber)
  const supervisorRows = tables.supervisorTable.rows
    .filter((row) => row.record.submission_id === records.submissionId)
    .map((row) => row.rowNumber)
  const requests: sheets_v4.Schema$Request[] = [
    ...parentUpdateRequests(
      submissionSheetId,
      parents[0]!.rowNumber,
      tables.submissionTable.headers,
      records.submission,
    ),
    ...deleteRowsRequests(supervisorSheetId, supervisorRows),
    ...deleteRowsRequests(areaSheetId, areaRows),
    appendRequest(areaSheetId, tables.areaTable.headers, records.areas),
    appendRequest(
      supervisorSheetId,
      tables.supervisorTable.headers,
      records.supervisors,
    ),
  ]

  try {
    await executeSpreadsheetBatchUpdate(
      tables.config.spreadsheetId,
      requests,
    )
  } catch (error) {
    try {
      const stored = await getStoredSubmissionById(records.submissionId)
      if (recordsMatchStored(stored, records)) {
        return {
          submission: {
            submissionId: records.submissionId,
            createdAt: records.createdAt,
            updatedAt: records.updatedAt,
            mode: 'edit',
          },
          oldFileIdsToCleanup,
        }
      }
    } catch {
      // Preserve both old and new files when the outcome cannot be proven.
    }
    throw new SubmissionPersistenceError(true, error)
  }

  return {
    submission: {
      submissionId: records.submissionId,
      createdAt: records.createdAt,
      updatedAt: records.updatedAt,
      mode: 'edit',
    },
    oldFileIdsToCleanup,
  }
}
