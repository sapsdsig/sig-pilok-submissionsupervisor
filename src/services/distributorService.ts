import { mockDistributors } from '../data/mockDistributors'
import type { Distributor } from '../types/masterData'
import { fetchJson } from './apiClient'

const normalize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export interface DistributorService {
  getDistributors(query?: string): Promise<Distributor[]>
  isKnownDistributor(namaDistributor: string): boolean
}

export class MockDistributorService implements DistributorService {
  async getDistributors(query = ''): Promise<Distributor[]> {
    const key = normalize(query)
    return mockDistributors
      .filter((item) => normalize(item.namaDistributor).includes(key))
      .map((item) => ({ ...item }))
  }

  isKnownDistributor(namaDistributor: string): boolean {
    const key = normalize(namaDistributor)
    return mockDistributors.some(
      (item) => normalize(item.namaDistributor) === key,
    )
  }
}

export class ApiDistributorService implements DistributorService {
  private distributors: Distributor[] = []

  async getDistributors(query = ''): Promise<Distributor[]> {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : ''
    const distributors = await fetchJson<Distributor[]>(
      `/api/distributors${suffix}`,
    )
    if (!query) this.distributors = distributors
    return distributors
  }

  isKnownDistributor(namaDistributor: string): boolean {
    const key = normalize(namaDistributor)
    return this.distributors.some(
      (item) => normalize(item.namaDistributor) === key,
    )
  }
}

export const distributorService: DistributorService =
  new ApiDistributorService()
