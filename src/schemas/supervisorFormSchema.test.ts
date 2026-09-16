import { describe, expect, it } from 'vitest'
import { mockProvinceAreaRows } from '../data/mockProvinceAreas'
import { MockDistributorService } from '../services/distributorService'
import { MockRegionService } from '../services/regionService'
import type { SupervisorFormValues } from '../types/form'
import { createSupervisorFormSchema } from './supervisorFormSchema'

const distributorService = new MockDistributorService()
const regionService = new MockRegionService(mockProvinceAreaRows)

const schema = createSupervisorFormSchema({
  isKnownDistributor: (distributor) =>
    distributorService.isKnownDistributor(distributor),
  getProvince: (provinceId) => regionService.getProvince(provinceId),
  getArea: (provinceId, areaId) => regionService.getArea(provinceId, areaId),
})

const createKtp = (name = 'ktp.jpg', type = 'image/jpeg') =>
  new File(['sample'], name, { type })

const validValues = (): SupervisorFormValues => ({
  kodeDistributor: '0000000971',
  namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
  distributorTerverifikasi: {
    kodeDistributor: '0000000971',
    namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
  },
  wilayah: [
    {
      provinsiId: '11',
      provinsiName: 'ACEH',
      areaId: '502',
      areaName: 'Area 02',
      areaAp: 'SP',
      jumlahSupervisor: 1,
      supervisors: [{ namaSupervisor: 'Budi', ktp: createKtp() }],
    },
  ],
})

const messagesFor = (values: SupervisorFormValues): string[] => {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('supervisorFormSchema', () => {
  it('menerima payload lengkap dan memangkas nama Supervisor', () => {
    const values = validValues()
    values.wilayah[0].supervisors[0].namaSupervisor = '  Budi  '
    const result = schema.safeParse(values)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.wilayah[0].supervisors[0].namaSupervisor).toBe('Budi')
    }
  })

  it('menolak distributor yang tidak berasal dari lookup master', () => {
    const values = validValues()
    values.distributorTerverifikasi = null
    expect(messagesFor(values)).toContain(
      'Kode Distributor harus berhasil dicari sebelum melanjutkan.',
    )
  })

  it('menolak kombinasi Provinsi dan Area duplikat', () => {
    const values = validValues()
    values.wilayah.push({
      ...values.wilayah[0],
      supervisors: [{ namaSupervisor: 'Ani', ktp: createKtp('ani.png', 'image/png') }],
    })
    expect(messagesFor(values)).toContain(
      'Kombinasi Provinsi dan Area sudah digunakan.',
    )
  })

  it('menolak Area yang bukan milik Provinsi terpilih', () => {
    const values = validValues()
    values.wilayah[0].provinsiId = '94'
    values.wilayah[0].provinsiName = 'PAPUA'
    expect(messagesFor(values)).toContain(
      'Area tidak sesuai dengan Provinsi yang dipilih.',
    )
  })

  it('menolak jumlah array Supervisor yang tidak sesuai', () => {
    const values = validValues()
    values.wilayah[0].jumlahSupervisor = 2
    expect(messagesFor(values)).toContain('Jumlah data Supervisor belum sesuai.')
  })

  it('menolak nama kosong dan format file yang tidak didukung', () => {
    const values = validValues()
    values.wilayah[0].supervisors[0] = {
      namaSupervisor: '   ',
      ktp: createKtp('ktp.txt', 'text/plain'),
    }
    const messages = messagesFor(values)
    expect(messages).toContain('Nama Supervisor wajib diisi.')
    expect(messages).toContain('Format KTP harus JPG, JPEG, PNG, atau PDF.')
  })
})
