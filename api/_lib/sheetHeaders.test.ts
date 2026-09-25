import { describe, expect, it } from 'vitest'
import { MASTER_SUPERVISOR_HEADERS, SUBMISSION_AREA_HEADERS, SUBMISSION_SUPERVISOR_HEADERS } from './sheetHeaders.js'
describe('Phase 7 sheet headers', () => {
  it('defines final master and transaction schemas', () => {
    expect(MASTER_SUPERVISOR_HEADERS).toEqual(['AP', 'Vendor Name', 'Fullname', 'ID MDXL'])
    expect(SUBMISSION_AREA_HEADERS).toEqual(['submission_area_id', 'submission_id', 'ap', 'jumlah_supervisor'])
    expect(SUBMISSION_SUPERVISOR_HEADERS).toEqual(['supervisor_id', 'submission_id', 'submission_area_id', 'nama_distributor', 'ap', 'id_mdxl', 'supervisor_no', 'nama_supervisor', 'ktp_file_id', 'ktp_file_name', 'ktp_file_url'])
  })
})
