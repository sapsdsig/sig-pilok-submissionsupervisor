export type UploadedKtp = {
  fileId: string
  fileName: string
  mimeType: string
  fileUrl: string
}

export type KtpUploadContext = {
  requestToken: string
  namaDistributor: string
  provinsiName: string
  areaName: string
  supervisorNo: number
}

export type KtpUploadSessionRequest = KtpUploadContext & {
  namaSupervisor: string
  fileName: string
  mimeType: string
  size: number
}

export type KtpUploadSessionResponse = {
  uploadUrl: string
  storedFileName: string
}

export type ExistingKtpReference = {
  kind: 'existing'
}

export type NewUploadedKtp = UploadedKtp & {
  kind: 'new'
}

export type SubmissionRequest = {
  requestToken: string
  namaDistributor: string
  wilayah: Array<{
    submissionAreaId?: string
    provinsiName: string
    areaName: string
    supervisors: Array<{
      supervisorId?: string
      namaSupervisor: string
      ktp: ExistingKtpReference | NewUploadedKtp
    }>
  }>
}

export type SubmissionResult = {
  submissionId: string
  createdAt: string
  updatedAt: string
  mode: 'create' | 'edit'
}

export type StoredSupervisor = {
  supervisorId: string
  namaSupervisor: string
  ktp: ExistingKtpReference
}

export type StoredWilayah = {
  submissionAreaId: string
  provinsiName: string
  areaName: string
  supervisors: StoredSupervisor[]
}

export type StoredSubmission = {
  submissionId: string
  namaDistributor: string
  createdAt: string
  updatedAt: string
  wilayah: StoredWilayah[]
}

export type SubmissionLookupResponse =
  | { exists: false }
  | { exists: true; submission: StoredSubmission }
