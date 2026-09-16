import { describe, expect, it } from 'vitest'
import { mockProvinceAreaRows } from '../data/mockProvinceAreas'
import { MockDistributorService } from './distributorService'
import { MockRegionService } from './regionService'

const distributors = new MockDistributorService()
const regions = new MockRegionService(mockProvinceAreaRows)

describe('Phase 4 master services', () => {
  it('searches Distributor case-insensitively and returns canonical values', async () => {
    await expect(distributors.getDistributors('cendrawasih')).resolves.toEqual([
      { namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT' },
    ])
  })

  it('does not accept arbitrary Distributor text', () => {
    expect(distributors.isKnownDistributor('BUKAN MASTER')).toBe(false)
    expect(
      distributors.isKnownDistributor('cendrawasih mulia perkasa, pt'),
    ).toBe(true)
  })

  it('deduplicates Province names', async () => {
    await expect(regions.getProvinces()).resolves.toEqual([
      { provinsiName: 'ACEH' },
      { provinsiName: 'SUMATERA UTARA' },
      { provinsiName: 'PAPUA' },
    ])
  })

  it('filters and deduplicates Area by Province name', async () => {
    await expect(regions.getAreasByProvince('aceh')).resolves.toEqual([
      { areaName: 'Area 02' },
      { areaName: 'Area 01' },
    ])
    expect(regions.getArea('PAPUA', 'Area 02')).toBeUndefined()
  })
})
