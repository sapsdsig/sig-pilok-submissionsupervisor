import type { SupervisorFormValues } from '../types/form'
import type {
  DevelopmentSubmission,
  NormalizedSubmission,
} from '../types/submission'

export const normalizeSubmission = (
  values: SupervisorFormValues,
): NormalizedSubmission => ({
  kodeDistributor: values.kodeDistributor,
  namaDistributor: values.namaDistributor,
  wilayah: values.wilayah.map((area) => ({
    provinsiId: area.provinsiId,
    provinsiName: area.provinsiName,
    areaId: area.areaId,
    areaName: area.areaName,
    areaAp: area.areaAp,
    jumlahSupervisor: area.jumlahSupervisor,
    supervisors: area.supervisors.map((supervisor, index) => ({
      supervisorNo: index + 1,
      namaSupervisor: supervisor.namaSupervisor,
      ktp: supervisor.ktp as File,
    })),
  })),
})

export const toDevelopmentSubmission = (
  submission: NormalizedSubmission,
): DevelopmentSubmission => ({
  kodeDistributor: submission.kodeDistributor,
  namaDistributor: submission.namaDistributor,
  wilayah: submission.wilayah.map((area) => ({
    ...area,
    supervisors: area.supervisors.map((supervisor) => ({
      supervisorNo: supervisor.supervisorNo,
      namaSupervisor: supervisor.namaSupervisor,
      ktp: {
        name: supervisor.ktp.name,
        type: supervisor.ktp.type,
        size: supervisor.ktp.size,
      },
    })),
  })),
})
