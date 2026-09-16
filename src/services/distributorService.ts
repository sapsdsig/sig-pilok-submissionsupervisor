import { mockDistributors } from '../data/mockDistributors'
import type { Distributor } from '../types/masterData'
import { ApiClientError, fetchJson } from './apiClient'

export interface DistributorService {
  findByCode(code: string): Promise<Distributor | null>
  isKnownDistributor(distributor: Distributor): boolean
}

export class MockDistributorService implements DistributorService {
  async findByCode(code: string): Promise<Distributor | null> {
    const distributor = mockDistributors.find(
      (item) => item.kodeDistributor === code,
    )

    return distributor ? { ...distributor } : null
  }

  isKnownDistributor(distributor: Distributor): boolean {
    return mockDistributors.some(
      (item) =>
        item.kodeDistributor === distributor.kodeDistributor &&
        item.namaDistributor === distributor.namaDistributor,
    )
  }
}

export class ApiDistributorService implements DistributorService {
  private readonly resolved = new Map<string, Distributor>()

  async findByCode(code: string): Promise<Distributor | null> {
    try {
      const distributor = await fetchJson<Distributor>(
        `/api/distributors/${encodeURIComponent(code)}`,
      )
      this.resolved.set(distributor.kodeDistributor, distributor)
      return distributor
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === 'DISTRIBUTOR_NOT_FOUND'
      ) {
        return null
      }
      throw error
    }
  }

  isKnownDistributor(distributor: Distributor): boolean {
    const known = this.resolved.get(distributor.kodeDistributor)
    return known?.namaDistributor === distributor.namaDistributor
  }
}

export const distributorService: DistributorService = new ApiDistributorService()
