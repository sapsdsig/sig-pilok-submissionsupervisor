export const MASTER_DISTRIBUTOR_HEADERS = [
  'Kode Distributor',
  'Nama Distributor',
] as const

export const PROVINCE_AREA_HEADERS = [
  'Provinsi ID',
  'Provinsi Name',
  'Area ID',
  'Area Name',
  'Area AP',
] as const

export const SUBMISSION_HEADERS = [
  'submission_id',
  'kode_distributor',
  'nama_distributor',
  'created_at',
  'updated_at',
] as const

export const SUBMISSION_AREA_HEADERS = [
  'submission_area_id',
  'submission_id',
  'provinsi_id',
  'provinsi_name',
  'area_id',
  'area_name',
  'area_ap',
  'jumlah_supervisor',
] as const

export const SUBMISSION_SUPERVISOR_HEADERS = [
  'supervisor_id',
  'submission_id',
  'submission_area_id',
  'supervisor_no',
  'nama_supervisor',
  'ktp_file_id',
  'ktp_file_name',
  'ktp_file_url',
] as const
