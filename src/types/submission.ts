export type NormalizedSupervisor = {
  supervisorNo: number
  namaSupervisor: string
  ktp: File
}

export type NormalizedSubmissionArea = {
  provinsiId: string
  provinsiName: string
  areaId: string
  areaName: string
  areaAp: string
  jumlahSupervisor: number
  supervisors: NormalizedSupervisor[]
}

export type NormalizedSubmission = {
  kodeDistributor: string
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
      supervisors: Array<Omit<NormalizedSupervisor, 'ktp'> & { ktp: SafeFileMetadata }>
    }
  >
}
