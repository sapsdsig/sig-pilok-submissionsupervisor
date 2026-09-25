import { google, type sheets_v4 } from 'googleapis'
import { ApiError } from './errors.js'
import { getGoogleAuth } from './googleAuth.js'

export type SheetRecord = Readonly<Record<string, string>>

export type SheetRow = {
  rowNumber: number
  record: SheetRecord
}

export type SheetTable = {
  headers: string[]
  rows: SheetRow[]
}

export type WritableRecord = Readonly<Record<string, string | number>>

export type AppendTable = {
  sheetName: string
  sheetId: number
  headers: readonly string[]
  records: readonly WritableRecord[]
}

const sheetsApi = () => google.sheets({ version: 'v4', auth: getGoogleAuth() })

export const quoteSheetName = (sheetName: string) =>
  `'${sheetName.replaceAll("'", "''")}'`

function readGoogleErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined
  }
  const response = error.response
  if (
    typeof response !== 'object' ||
    response === null ||
    !('status' in response)
  ) {
    return undefined
  }
  return typeof response.status === 'number' ? response.status : undefined
}

export function parseSheetValues(
  sheetName: string,
  rawRows: readonly (readonly unknown[])[],
  requiredHeaders: readonly string[],
): SheetTable {
  if (rawRows.length === 0) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      `Sheet ${sheetName} tidak memiliki baris header.`,
    )
  }

  const headers = (rawRows[0] ?? []).map((cell) => String(cell).trim())
  const duplicates = headers.filter(
    (header, index) => header.length > 0 && headers.indexOf(header) !== index,
  )
  if (duplicates.length > 0) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      `Sheet ${sheetName} memiliki header duplikat: ${[...new Set(duplicates)].join(', ')}.`,
    )
  }

  const missing = requiredHeaders.filter((header) => !headers.includes(header))
  if (missing.length > 0) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      `Sheet ${sheetName} tidak memiliki header wajib: ${missing.join(', ')}.`,
    )
  }

  const rows = rawRows.slice(1).map((rawRow, rowIndex) => ({
    rowNumber: rowIndex + 2,
    record: Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        String(rawRow[columnIndex] ?? '').trim(),
      ]),
    ),
  }))

  return { headers, rows }
}

export async function readSheetTable(
  spreadsheetId: string,
  sheetName: string,
  requiredHeaders: readonly string[],
): Promise<SheetTable> {
  try {
    const response = await sheetsApi().spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A:ZZ`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
    return parseSheetValues(sheetName, response.data.values ?? [], requiredHeaders)
  } catch (error) {
    if (error instanceof ApiError) throw error
    const status = readGoogleErrorStatus(error)
    if (status === 400 || status === 403 || status === 404) {
      throw new ApiError(
        500,
        'GOOGLE_CONFIG_ERROR',
        `Spreadsheet atau sheet ${sheetName} tidak dapat diakses.`,
      )
    }
    throw error
  }
}

export async function getSheetIdMap(
  spreadsheetId: string,
  requiredSheetNames: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  let response
  try {
    response = await sheetsApi().spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    })
  } catch {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      'Spreadsheet tidak dapat dibuka.',
    )
  }

  const result = new Map<string, number>()
  for (const sheet of response.data.sheets ?? []) {
    const title = sheet.properties?.title
    const sheetId = sheet.properties?.sheetId
    if (title && sheetId !== undefined && sheetId !== null) {
      result.set(title, sheetId)
    }
  }

  const missing = requiredSheetNames.filter((name) => !result.has(name))
  if (missing.length > 0) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      `Sheet wajib tidak ditemukan: ${missing.join(', ')}.`,
    )
  }
  return result
}

function toExtendedValue(value: string | number | undefined) {
  return typeof value === 'number'
    ? { numberValue: value }
    : { stringValue: value ?? '' }
}

export async function appendTablesAtomically(
  spreadsheetId: string,
  tables: readonly AppendTable[],
): Promise<void> {
  const populatedTables = tables.filter((table) => table.records.length > 0)
  if (populatedTables.length === 0) return

  await sheetsApi().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: populatedTables.map((table) => ({
        appendCells: {
          sheetId: table.sheetId,
          fields: 'userEnteredValue',
          rows: table.records.map((record) => ({
            values: table.headers.map((header) =>
              Object.prototype.hasOwnProperty.call(record, header)
                ? { userEnteredValue: toExtendedValue(record[header]) }
                : {},
            ),
          })),
        },
      })),
    },
  })
}

export async function executeSpreadsheetBatchUpdate(
  spreadsheetId: string,
  requests: readonly sheets_v4.Schema$Request[],
): Promise<void> {
  if (requests.length === 0) return
  await sheetsApi().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [...requests] },
  })
}

export function extendedCellValue(value: string | number | undefined) {
  return toExtendedValue(value)
}

export async function verifySheetAccess(
  spreadsheetId: string,
  sheetName: string,
  requiredHeaders: readonly string[],
) {
  await readSheetTable(spreadsheetId, sheetName, requiredHeaders)
}
