import type {
  ApOption,
  Distributor,
  SupervisorMasterRow,
} from '../../src/types/masterData.js'
import { TimedCache } from './cache.js'
import { getMasterSupervisorSheetConfig } from './env.js'
import { ApiError } from './errors.js'
import { MASTER_SUPERVISOR_HEADERS } from './sheetHeaders.js'
import { readSheetTable, type SheetTable } from './sheets.js'

const MASTER_CACHE_TTL_MS = 60_000

export const normalizeMasterName = (value: string) =>
  value.trim().toLocaleUpperCase('id-ID')

const integrityError = (message: string) =>
  new ApiError(500, 'MASTER_DATA_CONFLICT', message)

export function parseSupervisorMaster(table: SheetTable): SupervisorMasterRow[] {
  const rows: SupervisorMasterRow[] = []
  const vendors = new Map<string, string>()
  const aps = new Map<string, string>()
  const identities = new Map<string, { fullname: string; rowNumber: number }>()
  const idMappings = new Map<string, { identity: string; rowNumber: number }>()

  for (const row of table.rows) {
    const parsed = {
      ap: row.record.AP?.trim() ?? '',
      vendorName: row.record['Vendor Name']?.trim() ?? '',
      fullname: row.record.Fullname?.trim() ?? '',
      idMdxl: row.record['ID MDXL']?.trim() ?? '',
    }
    if (!parsed.ap && !parsed.vendorName && !parsed.fullname && !parsed.idMdxl) continue
    if (Object.values(parsed).some((value) => !value)) {
      throw integrityError(`Data master_supervisor tidak lengkap pada baris ${row.rowNumber}.`)
    }

    const vendorKey = normalizeMasterName(parsed.vendorName)
    const apKey = normalizeMasterName(parsed.ap)
    const nameKey = normalizeMasterName(parsed.fullname)
    const idKey = normalizeMasterName(parsed.idMdxl)
    const canonicalVendor = vendors.get(vendorKey)
    const canonicalAp = aps.get(apKey)
    if (canonicalVendor && canonicalVendor !== parsed.vendorName) {
      throw integrityError(`Nama Vendor memiliki canonical yang bertentangan pada baris ${row.rowNumber}: ${parsed.vendorName}.`)
    }
    if (canonicalAp && canonicalAp !== parsed.ap) {
      throw integrityError(`Nama AP memiliki canonical yang bertentangan pada baris ${row.rowNumber}: ${parsed.ap}.`)
    }
    vendors.set(vendorKey, parsed.vendorName)
    aps.set(apKey, parsed.ap)

    const identity = `${vendorKey}::${apKey}::${idKey}`
    const existing = identities.get(identity)
    if (existing) {
      if (normalizeMasterName(existing.fullname) !== nameKey) {
        throw integrityError(`ID MDXL ${parsed.idMdxl} memiliki Fullname bertentangan pada baris ${existing.rowNumber} dan ${row.rowNumber}.`)
      }
      throw integrityError(`Baris master_supervisor duplikat pada baris ${existing.rowNumber} dan ${row.rowNumber}.`)
    }
    const idMapping = idMappings.get(idKey)
    if (idMapping && idMapping.identity !== identity) {
      throw integrityError(`ID MDXL ${parsed.idMdxl} dipetakan ke identitas berbeda pada baris ${idMapping.rowNumber} dan ${row.rowNumber}.`)
    }
    identities.set(identity, { fullname: parsed.fullname, rowNumber: row.rowNumber })
    idMappings.set(idKey, { identity, rowNumber: row.rowNumber })
    rows.push(parsed)
  }
  return rows
}

export async function loadSupervisorMaster(
  readTable: typeof readSheetTable = readSheetTable,
): Promise<SupervisorMasterRow[]> {
  const config = getMasterSupervisorSheetConfig()
  return parseSupervisorMaster(
    await readTable(config.spreadsheetId, config.sheetName, MASTER_SUPERVISOR_HEADERS),
  )
}

const masterCache = new TimedCache(loadSupervisorMaster, MASTER_CACHE_TTL_MS)

export function extractDistributors(rows: readonly SupervisorMasterRow[]): Distributor[] {
  const values = new Map<string, Distributor>()
  for (const row of rows) {
    const key = normalizeMasterName(row.vendorName)
    if (!values.has(key)) values.set(key, { namaDistributor: row.vendorName })
  }
  return [...values.values()]
}

export function extractApOptions(
  rows: readonly SupervisorMasterRow[],
  namaDistributor: string,
): ApOption[] {
  const vendorKey = normalizeMasterName(namaDistributor)
  const values = new Map<string, ApOption>()
  for (const row of rows) {
    if (normalizeMasterName(row.vendorName) !== vendorKey) continue
    const key = normalizeMasterName(row.ap)
    if (!values.has(key)) values.set(key, { ap: row.ap })
  }
  return [...values.values()]
}

export async function getDistributors(query = ''): Promise<Distributor[]> {
  const values = extractDistributors(await masterCache.get())
  const key = normalizeMasterName(query)
  return key ? values.filter((item) => normalizeMasterName(item.namaDistributor).includes(key)) : values
}

export async function getCanonicalDistributor(name: string): Promise<Distributor> {
  const key = normalizeMasterName(name)
  const distributor = extractDistributors(await masterCache.get()).find(
    (item) => normalizeMasterName(item.namaDistributor) === key,
  )
  if (!distributor) throw new ApiError(404, 'DISTRIBUTOR_NOT_FOUND', 'Distributor tidak ditemukan pada master.')
  return distributor
}

export async function getApOptions(namaDistributor: string): Promise<ApOption[]> {
  const distributor = await getCanonicalDistributor(namaDistributor)
  return extractApOptions(await masterCache.get(), distributor.namaDistributor)
}

export async function getCanonicalDistributorAp(
  namaDistributor: string,
  ap: string,
): Promise<{ distributor: Distributor; ap: ApOption }> {
  const distributor = await getCanonicalDistributor(namaDistributor)
  const apKey = normalizeMasterName(ap)
  const canonicalAp = (await getApOptions(distributor.namaDistributor)).find(
    (item) => normalizeMasterName(item.ap) === apKey,
  )
  if (!canonicalAp) throw new ApiError(400, 'AP_NOT_FOUND', 'AP tidak terdaftar untuk Distributor yang dipilih.')
  return { distributor, ap: canonicalAp }
}

export async function getCanonicalBaselineSupervisor(input: {
  namaDistributor: string
  ap: string
  idMdxl: string
  namaSupervisor: string
}): Promise<SupervisorMasterRow> {
  const row = (await masterCache.get()).find(
    (item) =>
      normalizeMasterName(item.vendorName) === normalizeMasterName(input.namaDistributor) &&
      normalizeMasterName(item.ap) === normalizeMasterName(input.ap) &&
      normalizeMasterName(item.idMdxl) === normalizeMasterName(input.idMdxl),
  )
  if (!row || normalizeMasterName(row.fullname) !== normalizeMasterName(input.namaSupervisor)) {
    throw new ApiError(400, 'BASELINE_IDENTITY_INVALID', 'Identitas Supervisor baseline tidak sesuai dengan master_supervisor.')
  }
  return row
}
