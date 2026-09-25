export const MASTER_SUPERVISOR_HEADERS = [
  'AP',
  'Vendor Name',
  'Fullname',
  'ID MDXL',
] as const

export const SUBMISSION_HEADERS = [
  'submission_id',
  'nama_distributor',
  'created_at',
  'updated_at',
] as const

export const SUBMISSION_AREA_HEADERS = [
  'submission_area_id',
  'submission_id',
  'ap',
  'jumlah_supervisor',
] as const

export const SUBMISSION_SUPERVISOR_HEADERS = [
  'supervisor_id',
  'submission_id',
  'submission_area_id',
  'nama_distributor',
  'ap',
  'id_mdxl',
  'supervisor_no',
  'nama_supervisor',
  'ktp_file_id',
  'ktp_file_name',
  'ktp_file_url',
] as const
