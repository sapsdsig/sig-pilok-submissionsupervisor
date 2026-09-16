import type {
  AreaOption,
  ProvinceAreaMasterRow,
  ProvinceOption,
} from '../types/masterData'
import { fetchJson } from './apiClient'

const normalize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export interface RegionService {
  getProvinces(): Promise<ProvinceOption[]>
  getAreasByProvince(provinsiName: string): Promise<AreaOption[]>
  getProvince(provinsiName: string): ProvinceOption | undefined
  getArea(provinsiName: string, areaName: string): AreaOption | undefined
}

export class MockRegionService implements RegionService {
  constructor(private readonly rows: readonly ProvinceAreaMasterRow[]) {}

  async getProvinces(): Promise<ProvinceOption[]> {
    const distinct = new Map<string, ProvinceOption>()
    for (const row of this.rows) {
      const key = normalize(row.provinsiName)
      if (!distinct.has(key)) {
        distinct.set(key, { provinsiName: row.provinsiName })
      }
    }
    return [...distinct.values()]
  }

  async getAreasByProvince(provinsiName: string): Promise<AreaOption[]> {
    const provinceKey = normalize(provinsiName)
    const distinct = new Map<string, AreaOption>()
    for (const row of this.rows) {
      const areaKey = normalize(row.areaName)
      if (
        normalize(row.provinsiName) === provinceKey &&
        !distinct.has(areaKey)
      ) {
        distinct.set(areaKey, { areaName: row.areaName })
      }
    }
    return [...distinct.values()]
  }

  getProvince(provinsiName: string): ProvinceOption | undefined {
    const key = normalize(provinsiName)
    const row = this.rows.find((item) => normalize(item.provinsiName) === key)
    return row ? { provinsiName: row.provinsiName } : undefined
  }

  getArea(provinsiName: string, areaName: string): AreaOption | undefined {
    const provinceKey = normalize(provinsiName)
    const areaKey = normalize(areaName)
    const row = this.rows.find(
      (item) =>
        normalize(item.provinsiName) === provinceKey &&
        normalize(item.areaName) === areaKey,
    )
    return row ? { areaName: row.areaName } : undefined
  }
}

export class ApiRegionService implements RegionService {
  private provinces: ProvinceOption[] = []
  private readonly areas = new Map<string, AreaOption[]>()

  async getProvinces(): Promise<ProvinceOption[]> {
    const provinces = await fetchJson<ProvinceOption[]>('/api/regions/provinces')
    this.provinces = provinces
    return provinces
  }

  async getAreasByProvince(provinsiName: string): Promise<AreaOption[]> {
    const areas = await fetchJson<AreaOption[]>(
      `/api/regions/areas?provinceName=${encodeURIComponent(provinsiName)}`,
    )
    this.areas.set(normalize(provinsiName), areas)
    return areas
  }

  getProvince(provinsiName: string): ProvinceOption | undefined {
    const key = normalize(provinsiName)
    return this.provinces.find(
      (province) => normalize(province.provinsiName) === key,
    )
  }

  getArea(provinsiName: string, areaName: string): AreaOption | undefined {
    const areaKey = normalize(areaName)
    return this.areas
      .get(normalize(provinsiName))
      ?.find((area) => normalize(area.areaName) === areaKey)
  }
}

export const regionService: RegionService = new ApiRegionService()
