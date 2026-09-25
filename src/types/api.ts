export type UploadedKtp = { fileId: string; fileName: string; mimeType: string; fileUrl: string }
export type KtpUploadContext = {
  requestToken: string
  namaDistributor: string
  ap: string
  supervisorNo: number
}
export type KtpUploadSessionRequest = KtpUploadContext & {
  namaSupervisor: string
  fileName: string
  mimeType: string
  size: number
}
export type KtpUploadSessionResponse = { uploadUrl: string; storedFileName: string }
export type ExistingKtpReference = { kind: 'existing' }
export type NotRequiredKtpReference = { kind: 'not-required' }
export type NewUploadedKtp = UploadedKtp & { kind: 'new' }

export type SubmissionRequest = {
  requestToken: string
  namaDistributor: string
  ap: string
  submissionAreaId?: string
  supervisors: Array<{
    supervisorId?: string
    idMdxl?: string
    source: 'baseline' | 'custom'
    namaSupervisor: string
    ktp: ExistingKtpReference | NotRequiredKtpReference | NewUploadedKtp
  }>
}

export type SubmissionResult = {
  submissionId: string
  createdAt: string
  updatedAt: string
  mode: 'create' | 'edit'
}

export type StoredSupervisor = {
  supervisorId?: string
  idMdxl?: string
  source: 'baseline' | 'custom'
  namaSupervisor: string
  ktp: ExistingKtpReference | NotRequiredKtpReference
}
export type StoredSubmission = {
  submissionId: string
  submissionAreaId: string
  namaDistributor: string
  ap: string
  createdAt: string
  updatedAt: string
  supervisors: StoredSupervisor[]
}
export type SubmissionLookupResponse =
  | { exists: false; source: 'baseline'; supervisors: StoredSupervisor[] }
  | { exists: true; source: 'submission'; submission: StoredSubmission }
