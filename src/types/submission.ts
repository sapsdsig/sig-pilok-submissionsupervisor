import type { KtpState } from './form'

export type NormalizedSupervisor = {
  supervisorId?: string
  idMdxl?: string
  source: 'baseline' | 'custom'
  supervisorNo: number
  namaSupervisor: string
  ktp: KtpState
}
export type NormalizedSubmission = {
  namaDistributor: string
  ap: string
  submissionAreaId?: string
  jumlahSupervisor: number
  supervisors: NormalizedSupervisor[]
}
export type SafeFileMetadata = { name: string; type: string; size: number }
export type DevelopmentSubmission = Omit<NormalizedSubmission, 'supervisors'> & {
  supervisors: Array<Omit<NormalizedSupervisor, 'ktp'> & {
    ktp: SafeFileMetadata | { kind: 'existing' | 'not-required' } | null
  }>
}
