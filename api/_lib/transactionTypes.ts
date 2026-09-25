export type PersistedKtp = { fileId: string; fileName: string; fileUrl: string }
export type PersistedSupervisor = {
  supervisorId: string
  idMdxl: string
  namaSupervisor: string
  ktp?: PersistedKtp
}
export type PersistedSubmission = {
  submissionId: string
  submissionAreaId: string
  namaDistributor: string
  ap: string
  createdAt: string
  updatedAt: string
  supervisors: PersistedSupervisor[]
}
