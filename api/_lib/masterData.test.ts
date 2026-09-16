import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadDistributorMaster,
  loadRegionMaster,
  parseDistributorMaster,
  parseRegionMaster,
} from './masterData.js'
import { parseSheetValues } from './sheets.js'
import {
  MASTER_DISTRIBUTOR_HEADERS,
  PROVINCE_AREA_HEADERS,
} from './sheetHeaders.js'

describe('Google master parsers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('mempertahankan Kode Distributor dengan leading zero', () => {
    const table = parseSheetValues(
      'master_distributor',
      [
        [...MASTER_DISTRIBUTOR_HEADERS],
        ['0000000971', 'CENDRAWASIH MULIA PERKASA, PT'],
        ['33063', 'TRICO BANGUN MILLENIA INDONESIA, PT'],
      ],
      MASTER_DISTRIBUTOR_HEADERS,
    )

    expect(parseDistributorMaster(table)[0]).toEqual({
      kodeDistributor: '0000000971',
      namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
    })
  })

  it('mendeduplikasi Provinsi dan Area berdasarkan ID stabil', () => {
    const table = parseSheetValues(
      'provinsi_area',
      [
        [...PROVINCE_AREA_HEADERS],
        ['11', 'ACEH', '502', 'Area 02', 'SP'],
        ['11', 'ACEH', '502', 'Area 02', 'SP'],
        ['94', 'PAPUA', '597', 'Area 97', 'ST'],
      ],
      PROVINCE_AREA_HEADERS,
    )
    const master = parseRegionMaster(table)

    expect(master.provinces).toHaveLength(2)
    expect(master.areasByProvince.get('11')).toEqual([
      { areaId: '502', areaName: 'Area 02', areaAp: 'SP' },
    ])
    expect(master.areasByProvince.get('94')?.[0]?.areaAp).toBe('ST')
  })

  it('menerima header Provinsi/Area sederhana tanpa Kabupaten atau Kecamatan', () => {
    expect(PROVINCE_AREA_HEADERS).toEqual([
      'Provinsi ID',
      'Provinsi Name',
      'Area ID',
      'Area Name',
      'Area AP',
    ])
  })

  it('memuat distributor dari spreadsheet khusus distributor', async () => {
    vi.stubEnv('GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID', 'distributor-file-id')
    const readTable = vi.fn(async () => ({
      headers: [...MASTER_DISTRIBUTOR_HEADERS],
      rows: [],
    }))

    await loadDistributorMaster(readTable)
    expect(readTable).toHaveBeenCalledWith(
      'distributor-file-id',
      'master_distributor',
      MASTER_DISTRIBUTOR_HEADERS,
    )
  })

  it('memuat Provinsi/Area dari spreadsheet khusus wilayah', async () => {
    vi.stubEnv('GOOGLE_PROVINSI_AREA_SPREADSHEET_ID', 'region-file-id')
    const readTable = vi.fn(async () => ({
      headers: [...PROVINCE_AREA_HEADERS],
      rows: [],
    }))

    await loadRegionMaster(readTable)
    expect(readTable).toHaveBeenCalledWith(
      'region-file-id',
      'provinsi_area',
      PROVINCE_AREA_HEADERS,
    )
  })
})
