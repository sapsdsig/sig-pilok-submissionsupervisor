export type PersistedKtp = {
  fileId: string
  fileName: string
  fileUrl: string
}

export type PersistedSupervisor = {
  supervisorId: string
  namaSupervisor: string
  ktp: PersistedKtp
}

export type PersistedWilayah = {
  submissionAreaId: string
  provinsiName: string
  areaName: string
  supervisors: PersistedSupervisor[]
}

export type PersistedSubmission = {
  submissionId: string
  namaDistributor: string
  createdAt: string
  updatedAt: string
  wilayah: PersistedWilayah[]
}
