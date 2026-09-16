import { z } from 'zod'
import type { UploadedKtp } from '../../src/types/api.js'
import type { AreaOption, Distributor, ProvinceOption } from '../../src/types/masterData.js'
import { isAllowedKtpMimeType, verifyUploadedKtp } from './drive.js'
import { ApiError } from './errors.js'
import { getCanonicalRegion, getDistributorByCode } from './masterData.js'
import { requestTokenSchema } from './requestToken.js'

const safeId = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
const driveFileId = z.string().trim().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/)

const uploadedKtpSchema = z
  .object({
    fileId: driveFileId,
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().refine(isAllowedKtpMimeType),
    fileUrl: z.url(),
  })
  .strict()

const supervisorSchema = z
  .object({
    namaSupervisor: z.string().trim().min(1).max(150),
    ktp: uploadedKtpSchema,
  })
  .strict()

const wilayahSchema = z
  .object({
    provinsiId: safeId,
    areaId: safeId,
    supervisors: z.array(supervisorSchema).min(1).max(10),
  })
  .strict()

const submissionSchema = z
  .object({
    requestToken: requestTokenSchema,
    kodeDistributor: z.string().trim().min(1).max(100),
    wilayah: z.array(wilayahSchema).min(1).max(100),
  })
  .strict()

export type ValidatedSupervisor = {
  namaSupervisor: string
  ktp: UploadedKtp
}

export type ValidatedWilayah = {
  province: ProvinceOption
  area: AreaOption
  supervisors: ValidatedSupervisor[]
}

export type ValidatedSubmission = {
  requestToken: string
  distributor: Distributor
  wilayah: ValidatedWilayah[]
}

export type SubmissionValidationDependencies = {
  getDistributor: typeof getDistributorByCode
  getRegion: typeof getCanonicalRegion
  verifyKtp: typeof verifyUploadedKtp
}

const defaultDependencies: SubmissionValidationDependencies = {
  getDistributor: getDistributorByCode,
  getRegion: getCanonicalRegion,
  verifyKtp: verifyUploadedKtp,
}

export async function validateAndNormalizeSubmission(
  rawInput: unknown,
  dependencies: SubmissionValidationDependencies = defaultDependencies,
): Promise<ValidatedSubmission> {
  const parsed = submissionSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw new ApiError(
      400,
      'SUBMISSION_INVALID',
      'Struktur submission tidak lengkap atau tidak valid.',
    )
  }

  const combinations = parsed.data.wilayah.map(
    (wilayah) => `${wilayah.provinsiId}::${wilayah.areaId}`,
  )
  if (new Set(combinations).size !== combinations.length) {
    throw new ApiError(
      400,
      'SUBMISSION_INVALID',
      'Kombinasi Provinsi dan Area tidak boleh digunakan lebih dari satu kali.',
    )
  }

  const fileIds = parsed.data.wilayah.flatMap((area) =>
    area.supervisors.map((supervisor) => supervisor.ktp.fileId),
  )
  if (new Set(fileIds).size !== fileIds.length) {
    throw new ApiError(
      400,
      'SUBMISSION_INVALID',
      'Satu file KTP tidak boleh digunakan untuk lebih dari satu Supervisor.',
    )
  }

  const [distributor, ...regions] = await Promise.all([
    dependencies.getDistributor(parsed.data.kodeDistributor),
    ...parsed.data.wilayah.map((wilayah) =>
      dependencies.getRegion(wilayah.provinsiId, wilayah.areaId),
    ),
  ])

  const wilayah = await Promise.all(
    parsed.data.wilayah.map(async (area, areaIndex): Promise<ValidatedWilayah> => {
      const region = regions[areaIndex]
      if (!region) {
        throw new ApiError(
          400,
          'REGION_NOT_FOUND',
          'Kombinasi Provinsi dan Area tidak valid.',
        )
      }

      const supervisors = await Promise.all(
        area.supervisors.map(async (supervisor, supervisorIndex) => {
          const verifiedKtp = await dependencies.verifyKtp(
            supervisor.ktp.fileId,
            {
              requestToken: parsed.data.requestToken,
              kodeDistributor: distributor.kodeDistributor,
              provinsiId: region.province.provinsiId,
              areaId: region.area.areaId,
              supervisorNo: supervisorIndex + 1,
            },
          )
          if (
            verifiedKtp.fileName !== supervisor.ktp.fileName ||
            verifiedKtp.mimeType !== supervisor.ktp.mimeType ||
            verifiedKtp.fileUrl !== supervisor.ktp.fileUrl
          ) {
            throw new ApiError(
              400,
              'KTP_INVALID',
              'Metadata KTP tidak sesuai dengan file Google Drive.',
            )
          }
          return {
            namaSupervisor: supervisor.namaSupervisor,
            ktp: verifiedKtp,
          }
        }),
      )

      return {
        province: region.province,
        area: region.area,
        supervisors,
      }
    }),
  )

  return {
    requestToken: parsed.data.requestToken,
    distributor,
    wilayah,
  }
}

const cleanupEnvelopeSchema = z.object({
  requestToken: requestTokenSchema,
  wilayah: z.array(
    z.object({
      supervisors: z.array(
        z.object({ ktp: z.object({ fileId: driveFileId }).passthrough() }).passthrough(),
      ),
    }).passthrough(),
  ),
}).passthrough()

export function extractCleanupCandidates(rawInput: unknown): {
  requestToken: string
  fileIds: string[]
} | null {
  const parsed = cleanupEnvelopeSchema.safeParse(rawInput)
  if (!parsed.success) return null
  return {
    requestToken: parsed.data.requestToken,
    fileIds: parsed.data.wilayah.flatMap((area) =>
      area.supervisors.map((supervisor) => supervisor.ktp.fileId),
    ),
  }
}
