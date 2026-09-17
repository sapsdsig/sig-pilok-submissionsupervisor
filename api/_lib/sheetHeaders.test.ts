import { describe, expect, it } from 'vitest'
import { SUBMISSION_SUPERVISOR_HEADERS } from './sheetHeaders.js'

describe('submission_supervisor headers', () => {
  it('requires the reporting-ready Supervisor columns in physical order', () => {
    expect(SUBMISSION_SUPERVISOR_HEADERS).toEqual([
      'supervisor_id',
      'submission_id',
      'submission_area_id',
      'nama_distributor',
      'provinsi',
      'area',
      'supervisor_no',
      'nama_supervisor',
      'ktp_file_id',
      'ktp_file_name',
      'ktp_file_url',
    ])
  })
})
