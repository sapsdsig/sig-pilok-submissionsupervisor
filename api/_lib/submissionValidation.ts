import { z } from 'zod'
import type {
  StoredSubmission,
  UploadedKtp,
} from '../../src/types/api.js'
import type {
  AreaOption,
  Distributor,
  ProvinceOption,
} from '../../src/types/masterData.js'
import {
  isAllowedKtpMimeType,
  verifyExistingKtp,
  verifyUploadedKtp,
} from './drive.js'
import { ApiError } from './errors.js'
import {
  getCanonicalDistributor,
  getCanonicalRegion,
  normalizeMasterName,
} from './masterData.js'
import { requestTokenSchema } from './requestToken.js'

const safeId = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)
const driveFileId = safeId.min(10)

const uploadedKtpSchema = z
  .object({
    kind: z.literal('new'),
    fileId: driveFileId,
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().refine(isAllowedKtpMimeType),
    fileUrl: z.url(),
  })
  .strict()

const existingKtpSchema = z
  .object({
    kind: z.literal('existing'),
    fileId: driveFileId,
  })
  .strict()

const supervisorSchema = z
  .object({
    supervisorId: safeId.optional(),
    namaSupervisor: z.string().trim().min(1).max(150),
    ktp: z.discriminatedUnion('kind', [
      uploadedKtpSchema,
      existingKtpSchema,
    ]),
  })
  .strict()

const wilayahSchema = z
  .object({
    submissionAreaId: safeId.optional(),
    provinsiName: z.string().trim().min(1).max(150),
    areaName: z.string().trim().min(1).max(150),
    supervisors: z.array(supervisorSchema).min(1).max(10),
  })
  .strict()

const submissionSchema = z
  .object({
    requestToken: requestTokenSchema,
    namaDistributor: z.string().trim().min(1).max(200),
    wilayah: z.array(wilayahSchema).min(1).max(100),
  })
  .strict()

export type ValidatedSupervisor = {
  supervisorId?: string
  namaSupervisor: string
  ktp: UploadedKtp
  ktpSource: 'existing' | 'new'
}

export type ValidatedWilayah = {
  submissionAreaId?: string
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
  getDistributor: typeof getCanonicalDistributor
  getRegion: typeof getCanonicalRegion
  verifyNewKtp: typeof verifyUploadedKtp
  verifyExistingKtp: typeof verifyExistingKtp
}

const defaultDependencies: SubmissionValidationDependencies = {
  getDistributor: getCanonicalDistributor,
  getRegion: getCanonicalRegion,
  verifyNewKtp: verifyUploadedKtp,
  verifyExistingKtp,
}

function validateUniqueValues(
  values: readonly string[],
  message: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new ApiError(400, 'SUBMISSION_INVALID', message)
  }
}

export async function validateAndNormalizeSubmission(
  rawInput: unknown,
  existing: StoredSubmission | null,
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

  validateUniqueValues(
    parsed.data.wilayah.map(
      (wilayah) =>
        `${normalizeMasterName(wilayah.provinsiName)}::${normalizeMasterName(wilayah.areaName)}`,
    ),
    'Kombinasi Provinsi dan Area tidak boleh digunakan lebih dari satu kali.',
  )
  validateUniqueValues(
    parsed.data.wilayah.flatMap((area) =>
      area.supervisors.map((supervisor) => supervisor.ktp.fileId),
    ),
    'Satu file KTP tidak boleh digunakan untuk lebih dari satu Supervisor.',
  )

  const distributor = await dependencies.getDistributor(
    parsed.data.namaDistributor,
  )
  if (
    existing &&
    normalizeMasterName(existing.namaDistributor) !==
      normalizeMasterName(distributor.namaDistributor)
  ) {
    throw new ApiError(
      409,
      'SUBMISSION_CONFLICT',
      'Submission tidak dimiliki oleh Distributor yang dipilih.',
    )
  }

  const existingAreas = new Map(
    existing?.wilayah.map((area) => [area.submissionAreaId, area]) ?? [],
  )
  const existingSupervisors = new Map(
    existing?.wilayah.flatMap((area) =>
      area.supervisors.map((supervisor) => [
        supervisor.supervisorId,
        { submissionAreaId: area.submissionAreaId, supervisor },
      ] as const),
    ) ?? [],
  )
  validateUniqueValues(
    parsed.data.wilayah
      .map((area) => area.submissionAreaId)
      .filter((id): id is string => Boolean(id)),
    'ID Wilayah tidak boleh digunakan lebih dari satu kali.',
  )
  validateUniqueValues(
    parsed.data.wilayah.flatMap((area) =>
      area.supervisors
        .map((supervisor) => supervisor.supervisorId)
        .filter((id): id is string => Boolean(id)),
    ),
    'ID Supervisor tidak boleh digunakan lebih dari satu kali.',
  )

  const regions = await Promise.all(
    parsed.data.wilayah.map((area) =>
      dependencies.getRegion(area.provinsiName, area.areaName),
    ),
  )

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
      if (area.submissionAreaId && !existingAreas.has(area.submissionAreaId)) {
        throw new ApiError(
          400,
          'SUBMISSION_INVALID',
          'Referensi Wilayah tersimpan tidak valid.',
        )
      }

      const supervisors = await Promise.all(
        area.supervisors.map(async (supervisor, supervisorIndex) => {
          const stored = supervisor.supervisorId
            ? existingSupervisors.get(supervisor.supervisorId)
            : undefined
          if (
            supervisor.supervisorId &&
            (!stored || stored.submissionAreaId !== area.submissionAreaId)
          ) {
            throw new ApiError(
              400,
              'SUBMISSION_INVALID',
              'Referensi Supervisor tersimpan tidak valid.',
            )
          }

          let verifiedKtp: UploadedKtp
          if (supervisor.ktp.kind === 'existing') {
            if (!stored || stored.supervisor.ktp.fileId !== supervisor.ktp.fileId) {
              throw new ApiError(
                400,
                'KTP_INVALID',
                'KTP tersimpan bukan milik Supervisor pada submission ini.',
              )
            }
            verifiedKtp = await dependencies.verifyExistingKtp(
              supervisor.ktp.fileId,
              stored.supervisor.ktp,
            )
          } else {
            verifiedKtp = await dependencies.verifyNewKtp(
              supervisor.ktp.fileId,
              {
                requestToken: parsed.data.requestToken,
                namaDistributor: distributor.namaDistributor,
                provinsiName: region.province.provinsiName,
                areaName: region.area.areaName,
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
          }

          return {
            supervisorId: supervisor.supervisorId,
            namaSupervisor: supervisor.namaSupervisor,
            ktp: verifiedKtp,
            ktpSource: supervisor.ktp.kind,
          }
        }),
      )

      return {
        submissionAreaId: area.submissionAreaId,
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

const cleanupEnvelopeSchema = z
  .object({
    requestToken: requestTokenSchema,
    wilayah: z.array(
      z.object({
        supervisors: z.array(
          z.object({
            ktp: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('new'), fileId: driveFileId }).passthrough(),
              z.object({ kind: z.literal('existing'), fileId: driveFileId }).passthrough(),
            ]),
          }).passthrough(),
        ),
      }).passthrough(),
    ),
  })
  .passthrough()

export function extractCleanupCandidates(rawInput: unknown): {
  requestToken: string
  fileIds: string[]
} | null {
  const parsed = cleanupEnvelopeSchema.safeParse(rawInput)
  if (!parsed.success) return null
  return {
    requestToken: parsed.data.requestToken,
    fileIds: parsed.data.wilayah.flatMap((area) =>
      area.supervisors
        .filter((supervisor) => supervisor.ktp.kind === 'new')
        .map((supervisor) => supervisor.ktp.fileId),
    ),
  }
}
