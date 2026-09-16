import { describe, expect, it } from 'vitest'
import { mockProvinceAreaRows } from '../data/mockProvinceAreas'
import { MockDistributorService } from '../services/distributorService'
import { MockRegionService } from '../services/regionService'
import type { SupervisorFormValues } from '../types/form'
import { createSupervisorFormSchema } from './supervisorFormSchema'

const distributors = new MockDistributorService()
const regions = new MockRegionService(mockProvinceAreaRows)
const schema = createSupervisorFormSchema({
  isKnownDistributor: (name) => distributors.isKnownDistributor(name),
  getProvince: (name) => regions.getProvince(name),
  getArea: (province, area) => regions.getArea(province, area),
})
const file = () => new File(['sample'], 'ktp.pdf', { type: 'application/pdf' })
const valid = (): SupervisorFormValues => ({
  namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
  wilayah: [
    {
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        { namaSupervisor: 'Budi', ktp: { kind: 'new', file: file() } },
      ],
    },
  ],
})
const messages = (values: SupervisorFormValues) => {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('Phase 4 frontend form schema', () => {
  it('accepts a new Supervisor with a valid local KTP', () => {
    expect(schema.safeParse(valid()).success).toBe(true)
  })

  it('accepts an existing KTP without re-upload', () => {
    const values = valid()
    values.wilayah[0]!.supervisors[0]!.ktp = {
      kind: 'existing',
      fileId: 'file_123456789',
      fileName: 'KTP_BUDI.pdf',
      fileUrl: 'https://drive.google.com/file/d/file_123456789/view',
    }
    expect(schema.safeParse(values).success).toBe(true)
  })

  it('rejects arbitrary Distributor text', () => {
    const values = valid()
    values.namaDistributor = 'BUKAN MASTER'
    expect(messages(values)).toContain('Distributor harus dipilih dari master.')
  })

  it('rejects duplicate Province and Area combinations', () => {
    const values = valid()
    values.wilayah.push({
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [
        { namaSupervisor: 'Ani', ktp: { kind: 'new', file: file() } },
      ],
    })
    expect(messages(values)).toContain(
      'Kombinasi Provinsi dan Area sudah digunakan.',
    )
  })

  it('rejects an Area outside its Province', () => {
    const values = valid()
    values.wilayah[0]!.provinsiName = 'PAPUA'
    expect(messages(values)).toContain(
      'Area tidak sesuai dengan Provinsi yang dipilih.',
    )
  })

  it('requires one to ten Supervisors and a KTP for new entries', () => {
    const values = valid()
    values.wilayah[0]!.supervisors[0]!.ktp = null
    expect(messages(values)).toContain('KTP Supervisor wajib dipilih.')
    values.wilayah[0]!.supervisors = Array.from({ length: 11 }, (_, index) => ({
      namaSupervisor: `Supervisor ${index}`,
      ktp: { kind: 'new' as const, file: file() },
    }))
    expect(messages(values)).toContain('Jumlah Supervisor maksimal 10.')
  })
})
