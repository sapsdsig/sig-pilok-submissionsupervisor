import { createHash } from 'node:crypto'
import type { SubmissionResult } from '../../src/types/api.js'
import { getSubmissionSheetConfig } from './env.js'
import {
  SUBMISSION_AREA_HEADERS,
  SUBMISSION_HEADERS,
  SUBMISSION_SUPERVISOR_HEADERS,
} from './sheetHeaders.js'
import {
  appendTablesAtomically,
  getSheetIdMap,
  readSheetTable,
  type WritableRecord,
} from './sheets.js'
import type { ValidatedSubmission } from './submissionValidation.js'
import { datePartFromRequestToken } from './requestToken.js'

export type TransactionRecords = {
  submissionId: string
  createdAt: string
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

export function buildTransactionRecords(
  input: ValidatedSubmission,
  now = new Date(),
): TransactionRecords {
  const createdAt = now.toISOString()
  const submissionId = createSubmissionId(input.requestToken)
  const areas: WritableRecord[] = []
  const supervisors: WritableRecord[] = []

  input.wilayah.forEach((wilayah, areaIndex) => {
    const submissionAreaId = `${submissionId}-A${String(areaIndex + 1).padStart(2, '0')}`
    areas.push({
      submission_area_id: submissionAreaId,
      submission_id: submissionId,
      provinsi_id: wilayah.province.provinsiId,
      provinsi_name: wilayah.province.provinsiName,
      area_id: wilayah.area.areaId,
      area_name: wilayah.area.areaName,
      area_ap: wilayah.area.areaAp,
      jumlah_supervisor: wilayah.supervisors.length,
    })

    wilayah.supervisors.forEach((supervisor, supervisorIndex) => {
      supervisors.push({
        supervisor_id: `${submissionAreaId}-S${String(supervisorIndex + 1).padStart(2, '0')}`,
        submission_id: submissionId,
        submission_area_id: submissionAreaId,
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
    submission: {
      submission_id: submissionId,
      kode_distributor: input.distributor.kodeDistributor,
      nama_distributor: input.distributor.namaDistributor,
      created_at: createdAt,
      updated_at: createdAt,
    },
    areas,
    supervisors,
  }
}

async function readTransactionTables() {
  const config = getSubmissionSheetConfig()
  const sheetNames = [
    config.submissionSheetName,
    config.submissionAreaSheetName,
    config.submissionSupervisorSheetName,
  ] as const
  const [submissionTable, areaTable, supervisorTable, sheetIds] =
    await Promise.all([
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
      getSheetIdMap(config.spreadsheetId, sheetNames),
    ])
  return { config, submissionTable, areaTable, supervisorTable, sheetIds }
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
  return {
    submissionId: expectedId,
    createdAt: row.record.created_at || now.toISOString(),
    duplicate: true,
  }
}

async function persistInternal(
  input: ValidatedSubmission,
): Promise<SubmissionResult> {
  const records = buildTransactionRecords(input)
  let transactionTables: Awaited<ReturnType<typeof readTransactionTables>>
  try {
    transactionTables = await readTransactionTables()
  } catch (error) {
    console.error('Transaction table preparation failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    throw new SubmissionPersistenceError(false, error)
  }
  const { config, submissionTable, areaTable, supervisorTable, sheetIds } =
    transactionTables
  const existing = submissionTable.rows.find(
    (row) => row.record.submission_id === records.submissionId,
  )
  if (existing) {
    return {
      submissionId: records.submissionId,
      createdAt: existing.record.created_at || records.createdAt,
      duplicate: true,
    }
  }

  const submissionSheetId = sheetIds.get(config.submissionSheetName)
  const areaSheetId = sheetIds.get(config.submissionAreaSheetName)
  const supervisorSheetId = sheetIds.get(config.submissionSupervisorSheetName)
  if (
    submissionSheetId === undefined ||
    areaSheetId === undefined ||
    supervisorSheetId === undefined
  ) {
    throw new Error('Validated sheet IDs unexpectedly missing.')
  }

  try {
    await appendTablesAtomically(config.spreadsheetId, [
      {
        sheetName: config.submissionSheetName,
        sheetId: submissionSheetId,
        headers: submissionTable.headers,
        records: [records.submission],
      },
      {
        sheetName: config.submissionAreaSheetName,
        sheetId: areaSheetId,
        headers: areaTable.headers,
        records: records.areas,
      },
      {
        sheetName: config.submissionSupervisorSheetName,
        sheetId: supervisorSheetId,
        headers: supervisorTable.headers,
        records: records.supervisors,
      },
    ])
  } catch (writeError) {
    console.error('Atomic transaction append failed', {
      errorName: writeError instanceof Error ? writeError.name : 'UnknownError',
      message: writeError instanceof Error ? writeError.message : 'Unknown error',
    })
    // A network failure can hide a successful Google response. Re-read the
    // deterministic parent ID before treating the uploaded files as orphaned.
    try {
      const stored = await hasStoredSubmission(input.requestToken)
      if (stored) return { ...stored, duplicate: false }
    } catch (checkError) {
      console.error('Unable to confirm ambiguous Sheets write', {
        errorName: checkError instanceof Error ? checkError.name : 'UnknownError',
      })
    }
    throw new SubmissionPersistenceError(true, writeError)
  }

  return {
    submissionId: records.submissionId,
    createdAt: records.createdAt,
    duplicate: false,
  }
}

const inFlightSubmissions = new Map<string, Promise<SubmissionResult>>()

export async function persistSubmission(
  input: ValidatedSubmission,
): Promise<SubmissionResult> {
  const existing = inFlightSubmissions.get(input.requestToken)
  if (existing) return existing

  const pending = persistInternal(input)
  inFlightSubmissions.set(input.requestToken, pending)
  try {
    return await pending
  } finally {
    inFlightSubmissions.delete(input.requestToken)
  }
}
