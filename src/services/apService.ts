import type { ApOption } from '../types/masterData'
import { fetchJson } from './apiClient'

const normalize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export const getAutoSelectedAp = (options: readonly ApOption[]): string =>
  options.length === 1 ? options[0]!.ap : ''

export class ApiApService {
  private readonly byDistributor = new Map<string, ApOption[]>()

  async getApOptions(namaDistributor: string): Promise<ApOption[]> {
    const options = await fetchJson<ApOption[]>(
      `/api/aps?namaDistributor=${encodeURIComponent(namaDistributor)}`,
    )
    this.byDistributor.set(normalize(namaDistributor), options)
    return options
  }

  isKnownAp(namaDistributor: string, ap: string): boolean {
    const key = normalize(ap)
    return this.byDistributor.get(normalize(namaDistributor))
      ?.some((item) => normalize(item.ap) === key) ?? false
  }
}

export const apService = new ApiApService()
