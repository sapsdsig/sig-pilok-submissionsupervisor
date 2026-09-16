export type Distributor = {
  kodeDistributor: string
  namaDistributor: string
}

export type ProvinceOption = {
  provinsiId: string
  provinsiName: string
}

export type AreaOption = {
  areaId: string
  areaName: string
  areaAp: string
}

export type ProvinceAreaMasterRow = ProvinceOption & AreaOption
