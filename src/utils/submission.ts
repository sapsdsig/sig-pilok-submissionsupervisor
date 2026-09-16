import type { SupervisorFormValues } from '../types/form'
import type {
  DevelopmentSubmission,
  NormalizedSubmission,
} from '../types/submission'

export const normalizeSubmission = (
  values: SupervisorFormValues,
): NormalizedSubmission => ({
  namaDistributor: values.namaDistributor,
  wilayah: values.wilayah.map((area) => ({
    submissionAreaId: area.submissionAreaId,
    provinsiName: area.provinsiName,
    areaName: area.areaName,
    jumlahSupervisor: area.supervisors.length,
    supervisors: area.supervisors.map((supervisor, index) => ({
      supervisorId: supervisor.supervisorId,
      supervisorNo: index + 1,
      namaSupervisor: supervisor.namaSupervisor,
      ktp: supervisor.ktp,
    })),
  })),
})

export const toDevelopmentSubmission = (
  submission: NormalizedSubmission,
): DevelopmentSubmission => ({
  namaDistributor: submission.namaDistributor,
  wilayah: submission.wilayah.map((area) => ({
    ...area,
    supervisors: area.supervisors.map((supervisor) => ({
      supervisorId: supervisor.supervisorId,
      supervisorNo: supervisor.supervisorNo,
      namaSupervisor: supervisor.namaSupervisor,
      ktp:
        supervisor.ktp?.kind === 'new'
          ? {
              name: supervisor.ktp.file.name,
              type: supervisor.ktp.file.type,
              size: supervisor.ktp.file.size,
            }
          : {
              fileId: supervisor.ktp?.fileId ?? '',
              fileName: supervisor.ktp?.fileName ?? '',
            },
    })),
  })),
})
