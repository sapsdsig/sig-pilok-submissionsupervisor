import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMasterSupervisorSheetConfig, getSubmissionSheetConfig } from './env.js'
describe('spreadsheet environment routing', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('uses the new master and transaction spreadsheet IDs', () => {
    vi.stubEnv('GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID', 'master-id'); vi.stubEnv('GOOGLE_SUBMISSION_SPREADSHEET_ID', 'submission-id')
    expect(getMasterSupervisorSheetConfig()).toEqual({ spreadsheetId: 'master-id', sheetName: 'master_supervisor' })
    expect(getSubmissionSheetConfig()).toMatchObject({ spreadsheetId: 'submission-id' })
  })
  it('requires the new master ID', () => {
    vi.stubEnv('GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID', '')
    expect(() => getMasterSupervisorSheetConfig()).toThrow('GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID')
  })
})
