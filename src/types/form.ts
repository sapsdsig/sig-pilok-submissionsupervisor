export type SupervisorEntry = {
  namaSupervisor: string
  ktp: File | null
}

export type WilayahEntry = {
  provinsiId: string
  provinsiName: string
  areaId: string
  areaName: string
  areaAp: string
  jumlahSupervisor: number
  supervisors: SupervisorEntry[]
}

export type ResolvedDistributor = {
  kodeDistributor: string
  namaDistributor: string
}

export type SupervisorFormValues = {
  kodeDistributor: string
  namaDistributor: string
  distributorTerverifikasi: ResolvedDistributor | null
  wilayah: WilayahEntry[]
}

export const createEmptySupervisor = (): SupervisorEntry => ({
  namaSupervisor: '',
  ktp: null,
})

export const createEmptyWilayah = (): WilayahEntry => ({
  provinsiId: '',
  provinsiName: '',
  areaId: '',
  areaName: '',
  areaAp: '',
  jumlahSupervisor: 1,
  supervisors: [createEmptySupervisor()],
})

export const createDefaultFormValues = (): SupervisorFormValues => ({
  kodeDistributor: '',
  namaDistributor: '',
  distributorTerverifikasi: null,
  wilayah: [createEmptyWilayah()],
})
