import { describe, expect, it } from 'vitest'
import { mockDistributors } from '../data/mockDistributors'
import { mockProvinceAreaRows } from '../data/mockProvinceAreas'
import { MockDistributorService } from './distributorService'
import { MockRegionService } from './regionService'

const distributorService = new MockDistributorService()
const regionService = new MockRegionService(mockProvinceAreaRows)

describe('distributorService', () => {
  it('mempertahankan leading zero dan mencocokkan kode secara eksak', async () => {
    await expect(distributorService.findByCode('0000000971')).resolves.toMatchObject({
      kodeDistributor: '0000000971',
    })
    await expect(distributorService.findByCode('971')).resolves.toBeNull()
    await expect(distributorService.findByCode(' 0000000971')).resolves.toBeNull()
  })

  it('menggunakan pasangan kode dan nama dari master mock', () => {
    expect(distributorService.isKnownDistributor(mockDistributors[0]!)).toBe(true)
  })
})

describe('regionService', () => {
  it('menghasilkan provinsi unik dari baris master granular', async () => {
    const provinces = await regionService.getProvinces()
    expect(provinces.map((item) => item.provinsiId)).toEqual(['11', '12', '94'])
  })

  it('menghasilkan area unik dan hanya untuk provinsi terkait', async () => {
    const acehAreas = await regionService.getAreasByProvince('11')
    expect(acehAreas).toEqual([
      { areaId: '502', areaName: 'Area 02', areaAp: 'SP' },
      { areaId: '501', areaName: 'Area 01', areaAp: 'SP' },
    ])
    expect(acehAreas.filter((item) => item.areaId === '502')).toHaveLength(1)
    await expect(regionService.getAreasByProvince('94')).resolves.toHaveLength(2)
  })
})
