import type { UploadedKtp } from './api'

export type ExistingKtp = Omit<UploadedKtp, 'mimeType'> & {
  kind: 'existing'
  mimeType?: string
}

export type NewKtp = {
  kind: 'new'
  file: File
  previous?: ExistingKtp
}

export type KtpState = ExistingKtp | NewKtp | null

export type SupervisorEntry = {
  supervisorId?: string
  namaSupervisor: string
  ktp: KtpState
}

export type WilayahEntry = {
  submissionAreaId?: string
  provinsiName: string
  areaName: string
  supervisors: SupervisorEntry[]
}

export type SupervisorFormValues = {
  namaDistributor: string
  wilayah: WilayahEntry[]
}

export const createEmptySupervisor = (): SupervisorEntry => ({
  namaSupervisor: '',
  ktp: null,
})

export const createEmptyWilayah = (): WilayahEntry => ({
  provinsiName: '',
  areaName: '',
  supervisors: [createEmptySupervisor()],
})

export const createDefaultFormValues = (): SupervisorFormValues => ({
  namaDistributor: '',
  wilayah: [createEmptyWilayah()],
})

export function addSupervisor(
  supervisors: readonly SupervisorEntry[],
): SupervisorEntry[] {
  return supervisors.length >= 10
    ? [...supervisors]
    : [...supervisors, createEmptySupervisor()]
}

export function removeSupervisor(
  supervisors: readonly SupervisorEntry[],
  index: number,
): SupervisorEntry[] {
  if (supervisors.length <= 1 || index < 0 || index >= supervisors.length) {
    return [...supervisors]
  }
  return supervisors.filter((_, currentIndex) => currentIndex !== index)
}
