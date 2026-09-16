import type {
  AreaOption,
  Distributor,
  ProvinceOption,
} from '../../src/types/masterData.js'
import { TimedCache } from './cache.js'
import {
  getMasterDistributorSheetConfig,
  getProvinceAreaSheetConfig,
} from './env.js'
import { ApiError } from './errors.js'
import {
  MASTER_DISTRIBUTOR_HEADERS,
  PROVINCE_AREA_HEADERS,
} from './sheetHeaders.js'
import { readSheetTable, type SheetTable } from './sheets.js'

const MASTER_CACHE_TTL_MS = 60_000

export type RegionMaster = {
  provinces: ProvinceOption[]
  areasByProvince: ReadonlyMap<string, AreaOption[]>
}

export const normalizeMasterName = (value: string) =>
  value.trim().toLocaleUpperCase('id-ID')

export function parseDistributorMaster(table: SheetTable): Distributor[] {
  const distributors = new Map<string, Distributor>()

  for (const row of table.rows) {
    const namaDistributor = row.record['Nama Distributor']?.trim() ?? ''
    if (!namaDistributor) continue
    const normalized = normalizeMasterName(namaDistributor)
    if (distributors.has(normalized)) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Nama Distributor duplikat pada master: ${namaDistributor} (baris ${row.rowNumber}).`,
      )
    }
    distributors.set(normalized, { namaDistributor })
  }

  return [...distributors.values()]
}

export function parseRegionMaster(table: SheetTable): RegionMaster {
  const provinces = new Map<string, ProvinceOption>()
  const areasByProvince = new Map<string, Map<string, AreaOption>>()

  for (const row of table.rows) {
    const provinsiName = row.record['Provinsi Name']?.trim() ?? ''
    const areaName = row.record['Area Name']?.trim() ?? ''
    if (!provinsiName && !areaName) continue
    if (!provinsiName || !areaName) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Data Provinsi/Area tidak lengkap pada baris ${row.rowNumber}.`,
      )
    }

    const provinceKey = normalizeMasterName(provinsiName)
    const canonicalProvince = provinces.get(provinceKey)
    if (
      canonicalProvince &&
      canonicalProvince.provinsiName !== provinsiName
    ) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Nama Provinsi tidak konsisten: ${provinsiName}.`,
      )
    }
    provinces.set(provinceKey, canonicalProvince ?? { provinsiName })

    const provinceAreas = areasByProvince.get(provinceKey) ?? new Map()
    const areaKey = normalizeMasterName(areaName)
    const canonicalArea = provinceAreas.get(areaKey)
    if (canonicalArea && canonicalArea.areaName !== areaName) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Nama Area tidak konsisten pada Provinsi ${provinsiName}: ${areaName}.`,
      )
    }
    provinceAreas.set(areaKey, canonicalArea ?? { areaName })
    areasByProvince.set(provinceKey, provinceAreas)
  }

  return {
    provinces: [...provinces.values()],
    areasByProvince: new Map(
      [...areasByProvince].map(([provinceKey, areas]) => [
        provinceKey,
        [...areas.values()],
      ]),
    ),
  }
}

export async function loadDistributorMaster(
  readTable: typeof readSheetTable = readSheetTable,
): Promise<Distributor[]> {
  const config = getMasterDistributorSheetConfig()
  const table = await readTable(
    config.spreadsheetId,
    config.sheetName,
    MASTER_DISTRIBUTOR_HEADERS,
  )
  return parseDistributorMaster(table)
}

export async function loadRegionMaster(
  readTable: typeof readSheetTable = readSheetTable,
): Promise<RegionMaster> {
  const config = getProvinceAreaSheetConfig()
  const table = await readTable(
    config.spreadsheetId,
    config.sheetName,
    PROVINCE_AREA_HEADERS,
  )
  return parseRegionMaster(table)
}

const distributorCache = new TimedCache(
  loadDistributorMaster,
  MASTER_CACHE_TTL_MS,
)
const regionCache = new TimedCache(loadRegionMaster, MASTER_CACHE_TTL_MS)

export async function getDistributors(query = ''): Promise<Distributor[]> {
  const distributors = await distributorCache.get()
  const normalizedQuery = normalizeMasterName(query)
  if (!normalizedQuery) return distributors
  return distributors.filter((item) =>
    normalizeMasterName(item.namaDistributor).includes(normalizedQuery),
  )
}

export async function getCanonicalDistributor(
  name: string,
): Promise<Distributor> {
  const distributors = await distributorCache.get()
  const normalized = normalizeMasterName(name)
  const distributor = distributors.find(
    (item) => normalizeMasterName(item.namaDistributor) === normalized,
  )
  if (!distributor) {
    throw new ApiError(
      404,
      'DISTRIBUTOR_NOT_FOUND',
      'Distributor tidak ditemukan pada master.',
    )
  }
  return distributor
}

export async function getProvinces(): Promise<ProvinceOption[]> {
  return (await regionCache.get()).provinces
}

export async function getAreasByProvince(
  provinceName: string,
): Promise<AreaOption[]> {
  const master = await regionCache.get()
  const provinceKey = normalizeMasterName(provinceName)
  if (
    !master.provinces.some(
      (province) =>
        normalizeMasterName(province.provinsiName) === provinceKey,
    )
  ) {
    throw new ApiError(404, 'REGION_NOT_FOUND', 'Provinsi tidak ditemukan.')
  }
  return master.areasByProvince.get(provinceKey) ?? []
}

export async function getCanonicalRegion(
  provinceName: string,
  areaName: string,
): Promise<{ province: ProvinceOption; area: AreaOption }> {
  const master = await regionCache.get()
  const provinceKey = normalizeMasterName(provinceName)
  const areaKey = normalizeMasterName(areaName)
  const province = master.provinces.find(
    (item) => normalizeMasterName(item.provinsiName) === provinceKey,
  )
  const area = master.areasByProvince
    .get(provinceKey)
    ?.find((item) => normalizeMasterName(item.areaName) === areaKey)
  if (!province || !area) {
    throw new ApiError(
      400,
      'REGION_NOT_FOUND',
      'Kombinasi Provinsi dan Area tidak valid.',
    )
  }
  return { province, area }
}
