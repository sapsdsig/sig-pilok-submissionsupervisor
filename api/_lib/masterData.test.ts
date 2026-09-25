import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractApOptions, extractDistributors, loadSupervisorMaster, parseSupervisorMaster } from './masterData.js'
import { MASTER_SUPERVISOR_HEADERS } from './sheetHeaders.js'
import { parseSheetValues } from './sheets.js'

const table = (rows: string[][]) => parseSheetValues('master_supervisor', [
  [...MASTER_SUPERVISOR_HEADERS], ...rows,
], MASTER_SUPERVISOR_HEADERS)

describe('master_supervisor parsing', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('extracts distinct Distributor and AP options canonically', () => {
    const rows = parseSupervisorMaster(table([
      ['Supervisor AP1 SP', 'VENDOR A', 'ANI', '1001'],
      ['Supervisor AP2 SP', 'VENDOR A', 'BUDI', '1002'],
      ['Supervisor AP1 SP', 'VENDOR B', 'CICI', '1003'],
    ]))
    expect(extractDistributors(rows)).toEqual([{ namaDistributor: 'VENDOR A' }, { namaDistributor: 'VENDOR B' }])
    expect(extractApOptions(rows, 'vendor a')).toEqual([{ ap: 'Supervisor AP1 SP' }, { ap: 'Supervisor AP2 SP' }])
  })
  it('rejects blank rows, duplicate identities, conflicting names, and conflicting ID mappings', () => {
    expect(() => parseSupervisorMaster(table([['AP', 'VENDOR', '', '1']]))).toThrow('tidak lengkap')
    expect(() => parseSupervisorMaster(table([['AP', 'VENDOR', 'ANI', '1'], ['AP', 'VENDOR', 'ANI', '1']]))).toThrow('duplikat')
    expect(() => parseSupervisorMaster(table([['AP', 'VENDOR', 'ANI', '1'], ['AP', 'VENDOR', 'BUDI', '1']]))).toThrow('Fullname bertentangan')
    expect(() => parseSupervisorMaster(table([['AP', 'VENDOR', 'ANI', '1'], ['AP2', 'VENDOR', 'ANI', '1']]))).toThrow('identitas berbeda')
  })
  it('uses the standalone master spreadsheet', async () => {
    vi.stubEnv('GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID', 'master-file')
    const read = vi.fn(async () => ({ headers: [...MASTER_SUPERVISOR_HEADERS], rows: [] }))
    await loadSupervisorMaster(read)
    expect(read).toHaveBeenCalledWith('master-file', 'master_supervisor', MASTER_SUPERVISOR_HEADERS)
  })
})
