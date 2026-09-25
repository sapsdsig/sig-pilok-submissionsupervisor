import type { SupervisorFormValues } from '../types/form'
import type { DevelopmentSubmission, NormalizedSubmission } from '../types/submission'

export const normalizeSubmission = (values: SupervisorFormValues): NormalizedSubmission => ({
  namaDistributor: values.namaDistributor,
  ap: values.ap,
  submissionAreaId: values.submissionAreaId,
  jumlahSupervisor: values.supervisors.length,
  supervisors: values.supervisors.map((supervisor, index) => ({
    ...supervisor,
    supervisorNo: index + 1,
  })),
})

export const toDevelopmentSubmission = (submission: NormalizedSubmission): DevelopmentSubmission => ({
  ...submission,
  supervisors: submission.supervisors.map((supervisor) => ({
    ...supervisor,
    ktp: supervisor.ktp?.kind === 'new'
      ? { name: supervisor.ktp.file.name, type: supervisor.ktp.file.type, size: supervisor.ktp.file.size }
      : supervisor.ktp?.kind === 'existing'
        ? { kind: 'existing' as const }
        : supervisor.ktp?.kind === 'not-required'
          ? { kind: 'not-required' as const }
          : null,
  })),
})
