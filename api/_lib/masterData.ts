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

export function parseDistributorMaster(table: SheetTable): Distributor[] {
  const distributors = new Map<string, Distributor>()

  for (const row of table.rows) {
    const kodeDistributor = row.record['Kode Distributor'] ?? ''
    const namaDistributor = row.record['Nama Distributor'] ?? ''
    if (!kodeDistributor && !namaDistributor) continue
    if (!kodeDistributor || !namaDistributor) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Data distributor tidak lengkap pada baris ${row.rowNumber}.`,
      )
    }

    const existing = distributors.get(kodeDistributor)
    if (existing && existing.namaDistributor !== namaDistributor) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Kode Distributor ${kodeDistributor} memiliki nama yang bertentangan.`,
      )
    }
    distributors.set(kodeDistributor, { kodeDistributor, namaDistributor })
  }

  return [...distributors.values()]
}

export function parseRegionMaster(table: SheetTable): RegionMaster {
  const provinces = new Map<string, ProvinceOption>()
  const areasByProvince = new Map<string, Map<string, AreaOption>>()

  for (const row of table.rows) {
    const provinsiId = row.record['Provinsi ID'] ?? ''
    const provinsiName = row.record['Provinsi Name'] ?? ''
    const areaId = row.record['Area ID'] ?? ''
    const areaName = row.record['Area Name'] ?? ''
    const areaAp = row.record['Area AP'] ?? ''
    if (!provinsiId && !provinsiName && !areaId && !areaName && !areaAp) continue
    if (!provinsiId || !provinsiName || !areaId || !areaName || !areaAp) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Data Provinsi/Area tidak lengkap pada baris ${row.rowNumber}.`,
      )
    }

    const existingProvince = provinces.get(provinsiId)
    if (existingProvince && existingProvince.provinsiName !== provinsiName) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Provinsi ID ${provinsiId} memiliki nama yang bertentangan.`,
      )
    }
    provinces.set(provinsiId, { provinsiId, provinsiName })

    const provinceAreas = areasByProvince.get(provinsiId) ?? new Map()
    const existingArea = provinceAreas.get(areaId)
    if (
      existingArea &&
      (existingArea.areaName !== areaName || existingArea.areaAp !== areaAp)
    ) {
      throw new ApiError(
        500,
        'MASTER_DATA_CONFLICT',
        `Area ID ${areaId} pada Provinsi ${provinsiId} memiliki data yang bertentangan.`,
      )
    }
    provinceAreas.set(areaId, { areaId, areaName, areaAp })
    areasByProvince.set(provinsiId, provinceAreas)
  }

  return {
    provinces: [...provinces.values()],
    areasByProvince: new Map(
      [...areasByProvince].map(([provinceId, areas]) => [
        provinceId,
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

export async function getDistributorByCode(code: string): Promise<Distributor> {
  const distributors = await distributorCache.get()
  const distributor = distributors.find(
    (item) => item.kodeDistributor === code,
  )
  if (!distributor) {
    throw new ApiError(
      404,
      'DISTRIBUTOR_NOT_FOUND',
      'Kode Distributor tidak ditemukan.',
    )
  }
  return distributor
}

export async function getProvinces(): Promise<ProvinceOption[]> {
  const master = await regionCache.get()
  return master.provinces
}

export async function getAreasByProvince(
  provinceId: string,
): Promise<AreaOption[]> {
  const master = await regionCache.get()
  if (!master.provinces.some((province) => province.provinsiId === provinceId)) {
    throw new ApiError(404, 'REGION_NOT_FOUND', 'Provinsi tidak ditemukan.')
  }
  return master.areasByProvince.get(provinceId) ?? []
}

export async function getCanonicalRegion(
  provinceId: string,
  areaId: string,
): Promise<{ province: ProvinceOption; area: AreaOption }> {
  const master = await regionCache.get()
  const province = master.provinces.find(
    (item) => item.provinsiId === provinceId,
  )
  const area = master.areasByProvince
    .get(provinceId)
    ?.find((item) => item.areaId === areaId)
  if (!province || !area) {
    throw new ApiError(
      400,
      'REGION_NOT_FOUND',
      'Kombinasi Provinsi dan Area tidak valid.',
    )
  }
  return { province, area }
}
