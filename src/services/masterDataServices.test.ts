import { describe, expect, it } from 'vitest'
import { MockDistributorService } from './distributorService'
import { getAutoSelectedAp } from './apService'

describe('Distributor service', () => {
  const service = new MockDistributorService()
  it('searches case-insensitively and returns canonical values', async () => {
    await expect(service.getDistributors('cendrawasih')).resolves.toEqual([{ namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT' }])
  })
  it('rejects arbitrary text', () => expect(service.isKnownDistributor('BUKAN MASTER')).toBe(false))
  it('auto-selects exactly one AP but requires selection for multiple APs', () => {
    expect(getAutoSelectedAp([{ ap: 'AP1' }])).toBe('AP1')
    expect(getAutoSelectedAp([{ ap: 'AP1' }, { ap: 'AP2' }])).toBe('')
  })
})
