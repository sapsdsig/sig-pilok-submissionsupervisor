export type UploadedKtp = {
  fileId: string
  fileName: string
  mimeType: string
  fileUrl: string
}

export type KtpUploadContext = {
  requestToken: string
  kodeDistributor: string
  provinsiId: string
  areaId: string
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

export type SubmissionRequest = {
  requestToken: string
  kodeDistributor: string
  wilayah: Array<{
    provinsiId: string
    areaId: string
    supervisors: Array<{
      namaSupervisor: string
      ktp: UploadedKtp
    }>
  }>
}

export type SubmissionResult = {
  submissionId: string
  createdAt: string
  duplicate: boolean
}
