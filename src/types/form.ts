export type ExistingKtp = { kind: 'existing' }
export type NotRequiredKtp = { kind: 'not-required' }
export type NewKtp = { kind: 'new'; file: File; previous?: ExistingKtp }
export type KtpState = ExistingKtp | NotRequiredKtp | NewKtp | null

export const getExistingKtp = (ktp: KtpState): ExistingKtp | undefined =>
  ktp?.kind === 'existing' ? ktp : ktp?.kind === 'new' ? ktp.previous : undefined

export const cancelNewKtpSelection = (ktp: KtpState): KtpState =>
  ktp?.kind === 'new' ? ktp.previous ?? null : ktp

type SupervisorBase = {
  supervisorId?: string
  namaSupervisor: string
  ktp: KtpState
}
export type SupervisorEntry =
  | (SupervisorBase & { source: 'baseline'; idMdxl: string })
  | (SupervisorBase & { source: 'custom'; idMdxl?: string })

export type SupervisorFormValues = {
  namaDistributor: string
  ap: string
  submissionAreaId?: string
  supervisors: SupervisorEntry[]
}

export const createEmptySupervisor = (): SupervisorEntry => ({
  source: 'custom',
  namaSupervisor: '',
  ktp: null,
})

export const createDefaultFormValues = (): SupervisorFormValues => ({
  namaDistributor: '',
  ap: '',
  supervisors: [],
})

export function addSupervisor(supervisors: readonly SupervisorEntry[]): SupervisorEntry[] {
  return supervisors.length >= 10 ? [...supervisors] : [...supervisors, createEmptySupervisor()]
}

export function removeSupervisor(supervisors: readonly SupervisorEntry[], index: number): SupervisorEntry[] {
  if (supervisors.length <= 1 || index < 0 || index >= supervisors.length) return [...supervisors]
  return supervisors.filter((_, currentIndex) => currentIndex !== index)
}
