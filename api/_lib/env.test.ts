import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getMasterDistributorSheetConfig,
  getProvinceAreaSheetConfig,
  getSubmissionSheetConfig,
} from './env.js'

describe('spreadsheet environment routing', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('menggunakan tiga spreadsheet ID yang eksplisit', () => {
    vi.stubEnv('GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID', 'master-distributor-id')
    vi.stubEnv('GOOGLE_PROVINSI_AREA_SPREADSHEET_ID', 'province-area-id')
    vi.stubEnv('GOOGLE_SUBMISSION_SPREADSHEET_ID', 'submission-id')

    expect(getMasterDistributorSheetConfig()).toMatchObject({
      spreadsheetId: 'master-distributor-id',
      sheetName: 'master_distributor',
    })
    expect(getProvinceAreaSheetConfig()).toMatchObject({
      spreadsheetId: 'province-area-id',
      sheetName: 'provinsi_area',
    })
    expect(getSubmissionSheetConfig()).toEqual({
      spreadsheetId: 'submission-id',
      submissionSheetName: 'submission',
      submissionAreaSheetName: 'submission_area',
      submissionSupervisorSheetName: 'submission_supervisor',
    })
  })

  it('mewajibkan ID distributor yang eksplisit', () => {
    vi.stubEnv('GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID', '')

    expect(() => getMasterDistributorSheetConfig()).toThrow(
      'GOOGLE_MASTER_DISTRIBUTOR_SPREADSHEET_ID',
    )
  })
})
