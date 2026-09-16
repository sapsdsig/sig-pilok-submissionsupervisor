import type {
  AreaOption,
  ProvinceAreaMasterRow,
  ProvinceOption,
} from '../types/masterData'
import { fetchJson } from './apiClient'

export interface RegionService {
  getProvinces(): Promise<ProvinceOption[]>
  getAreasByProvince(provinsiId: string): Promise<AreaOption[]>
  getProvince(provinsiId: string): ProvinceOption | undefined
  getArea(provinsiId: string, areaId: string): AreaOption | undefined
}

export class MockRegionService implements RegionService {
  constructor(private readonly rows: readonly ProvinceAreaMasterRow[]) {}

  async getProvinces(): Promise<ProvinceOption[]> {
    const distinct = new Map<string, ProvinceOption>()

    for (const row of this.rows) {
      if (!distinct.has(row.provinsiId)) {
        distinct.set(row.provinsiId, {
          provinsiId: row.provinsiId,
          provinsiName: row.provinsiName,
        })
      }
    }

    return [...distinct.values()]
  }

  async getAreasByProvince(provinsiId: string): Promise<AreaOption[]> {
    const distinct = new Map<string, AreaOption>()

    for (const row of this.rows) {
      if (row.provinsiId === provinsiId && !distinct.has(row.areaId)) {
        distinct.set(row.areaId, {
          areaId: row.areaId,
          areaName: row.areaName,
          areaAp: row.areaAp,
        })
      }
    }

    return [...distinct.values()]
  }

  getProvince(provinsiId: string): ProvinceOption | undefined {
    const row = this.rows.find((item) => item.provinsiId === provinsiId)
    return row
      ? { provinsiId: row.provinsiId, provinsiName: row.provinsiName }
      : undefined
  }

  getArea(provinsiId: string, areaId: string): AreaOption | undefined {
    const row = this.rows.find(
      (item) => item.provinsiId === provinsiId && item.areaId === areaId,
    )
    return row
      ? { areaId: row.areaId, areaName: row.areaName, areaAp: row.areaAp }
      : undefined
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

  async getAreasByProvince(provinsiId: string): Promise<AreaOption[]> {
    const areas = await fetchJson<AreaOption[]>(
      `/api/regions/areas?provinceId=${encodeURIComponent(provinsiId)}`,
    )
    this.areas.set(provinsiId, areas)
    return areas
  }

  getProvince(provinsiId: string): ProvinceOption | undefined {
    return this.provinces.find((province) => province.provinsiId === provinsiId)
  }

  getArea(provinsiId: string, areaId: string): AreaOption | undefined {
    return this.areas
      .get(provinsiId)
      ?.find((area) => area.areaId === areaId)
  }
}

export const regionService: RegionService = new ApiRegionService()
