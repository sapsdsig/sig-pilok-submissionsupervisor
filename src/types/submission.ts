import type { KtpState } from './form'

export type NormalizedSupervisor = {
  supervisorId?: string
  supervisorNo: number
  namaSupervisor: string
  ktp: KtpState
}

export type NormalizedSubmissionArea = {
  submissionAreaId?: string
  provinsiName: string
  areaName: string
  jumlahSupervisor: number
  supervisors: NormalizedSupervisor[]
}

export type NormalizedSubmission = {
  namaDistributor: string
  wilayah: NormalizedSubmissionArea[]
}

export type SafeFileMetadata = {
  name: string
  type: string
  size: number
}

export type DevelopmentSubmission = Omit<NormalizedSubmission, 'wilayah'> & {
  wilayah: Array<
    Omit<NormalizedSubmissionArea, 'supervisors'> & {
      supervisors: Array<
        Omit<NormalizedSupervisor, 'ktp'> & {
          ktp: SafeFileMetadata | { kind: 'existing' } | null
        }
      >
    }
  >
}
