import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadDistributorMaster,
  loadRegionMaster,
  normalizeMasterName,
  parseDistributorMaster,
  parseRegionMaster,
} from './masterData.js'
import {
  MASTER_DISTRIBUTOR_HEADERS,
  PROVINCE_AREA_HEADERS,
} from './sheetHeaders.js'
import { parseSheetValues } from './sheets.js'

describe('Phase 4 Google master parsers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('parses name-only Distributor rows and ignores blanks', () => {
    const table = parseSheetValues(
      'master_distributor',
      [['Nama Distributor'], [' DISTRIBUTOR A '], ['']],
      MASTER_DISTRIBUTOR_HEADERS,
    )
    expect(parseDistributorMaster(table)).toEqual([
      { namaDistributor: 'DISTRIBUTOR A' },
    ])
  })

  it('detects duplicate normalized Distributor names', () => {
    const table = parseSheetValues(
      'master_distributor',
      [['Nama Distributor'], ['Distributor A'], [' distributor a ']],
      MASTER_DISTRIBUTOR_HEADERS,
    )
    expect(() => parseDistributorMaster(table)).toThrow(
      'Nama Distributor duplikat',
    )
  })

  it('normalizes case-insensitive search keys without changing display data', () => {
    expect(normalizeMasterName(' cendrawasih ')).toBe('CENDRAWASIH')
  })

  it('parses and deduplicates Province and Area names', () => {
    const table = parseSheetValues(
      'provinsi_area',
      [
        ['Provinsi Name', 'Area Name'],
        ['ACEH', 'Area 02'],
        ['ACEH', 'Area 02'],
        ['PAPUA', 'Area 97'],
      ],
      PROVINCE_AREA_HEADERS,
    )
    const result = parseRegionMaster(table)
    expect(result.provinces).toEqual([
      { provinsiName: 'ACEH' },
      { provinsiName: 'PAPUA' },
    ])
    expect(result.areasByProvince.get('ACEH')).toEqual([
      { areaName: 'Area 02' },
    ])
  })

  it('uses the dedicated Distributor spreadsheet', async () => {
    vi.stubEnv('GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID', 'distributor-file')
    const read = vi.fn(async () => ({
      headers: [...MASTER_DISTRIBUTOR_HEADERS],
      rows: [],
    }))
    await loadDistributorMaster(read)
    expect(read).toHaveBeenCalledWith(
      'distributor-file',
      'master_distributor',
      ['Nama Distributor'],
    )
  })

  it('uses the dedicated Province/Area spreadsheet', async () => {
    vi.stubEnv('GOOGLE_PROVINSI_AREA_SPREADSHEET_ID', 'region-file')
    const read = vi.fn(async () => ({
      headers: [...PROVINCE_AREA_HEADERS],
      rows: [],
    }))
    await loadRegionMaster(read)
    expect(read).toHaveBeenCalledWith(
      'region-file',
      'provinsi_area',
      ['Provinsi Name', 'Area Name'],
    )
  })
})
