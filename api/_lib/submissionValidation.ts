import { z } from 'zod'
import type { UploadedKtp } from '../../src/types/api.js'
import type { ApOption, Distributor } from '../../src/types/masterData.js'
import { isAllowedKtpMimeType, verifyExistingKtp, verifyUploadedKtp } from './drive.js'
import { ApiError } from './errors.js'
import { getCanonicalBaselineSupervisor, getCanonicalDistributorAp, normalizeMasterName } from './masterData.js'
import { requestTokenSchema } from './requestToken.js'
import type { PersistedSubmission } from './transactionTypes.js'

const safeId = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)
const driveFileId = safeId.min(10)
const newKtpSchema = z.object({
  kind: z.literal('new'), fileId: driveFileId, fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().refine(isAllowedKtpMimeType), fileUrl: z.url(),
}).strict()
const existingKtpSchema = z.object({ kind: z.literal('existing') }).strict()
const notRequiredKtpSchema = z.object({ kind: z.literal('not-required') }).strict()

const supervisorSchema = z.object({
  supervisorId: safeId.optional(),
  idMdxl: z.string().trim().max(200).optional(),
  source: z.enum(['baseline', 'custom']),
  namaSupervisor: z.string().trim().min(1).max(150),
  ktp: z.discriminatedUnion('kind', [newKtpSchema, existingKtpSchema, notRequiredKtpSchema]),
}).strict()
const submissionSchema = z.object({
  requestToken: requestTokenSchema,
  namaDistributor: z.string().trim().min(1).max(200),
  ap: z.string().trim().min(1).max(150),
  submissionAreaId: safeId.optional(),
  supervisors: z.array(supervisorSchema).min(1).max(10),
}).strict()

export type ValidatedSupervisor = {
  supervisorId?: string
  idMdxl: string
  namaSupervisor: string
  ktp?: UploadedKtp
  ktpSource: 'not-required' | 'existing' | 'new'
}
export type ValidatedSubmission = {
  requestToken: string
  distributor: Distributor
  ap: ApOption
  submissionAreaId?: string
  supervisors: ValidatedSupervisor[]
}
export type SubmissionValidationDependencies = {
  getDistributorAp: typeof getCanonicalDistributorAp
  getBaseline: typeof getCanonicalBaselineSupervisor
  verifyNewKtp: typeof verifyUploadedKtp
  verifyExistingKtp: typeof verifyExistingKtp
}
const defaults: SubmissionValidationDependencies = {
  getDistributorAp: getCanonicalDistributorAp,
  getBaseline: getCanonicalBaselineSupervisor,
  verifyNewKtp: verifyUploadedKtp,
  verifyExistingKtp,
}

function unique(values: readonly string[], message: string) {
  if (new Set(values).size !== values.length) throw new ApiError(400, 'SUBMISSION_INVALID', message)
}

export async function validateAndNormalizeSubmission(
  rawInput: unknown,
  existing: PersistedSubmission | null,
  dependencies: SubmissionValidationDependencies = defaults,
): Promise<ValidatedSubmission> {
  const parsed = submissionSchema.safeParse(rawInput)
  if (!parsed.success) throw new ApiError(400, 'SUBMISSION_INVALID', 'Struktur submission tidak lengkap atau tidak valid.')
  const identity = await dependencies.getDistributorAp(parsed.data.namaDistributor, parsed.data.ap)
  if (existing && (
    normalizeMasterName(existing.namaDistributor) !== normalizeMasterName(identity.distributor.namaDistributor) ||
    normalizeMasterName(existing.ap) !== normalizeMasterName(identity.ap.ap)
  )) throw new ApiError(409, 'SUBMISSION_CONFLICT', 'Submission tidak dimiliki oleh Distributor + AP yang dipilih.')
  if (existing && parsed.data.submissionAreaId !== existing.submissionAreaId) {
    throw new ApiError(400, 'SUBMISSION_INVALID', 'Referensi AP tersimpan tidak valid.')
  }
  if (!existing && parsed.data.submissionAreaId) throw new ApiError(400, 'SUBMISSION_INVALID', 'Submission baru tidak boleh membawa ID area.')

  unique(parsed.data.supervisors.flatMap((item) => item.supervisorId ? [item.supervisorId] : []), 'ID Supervisor tidak boleh duplikat.')
  unique(parsed.data.supervisors.flatMap((item) => item.idMdxl ? [normalizeMasterName(item.idMdxl)] : []), 'ID MDXL tidak boleh duplikat.')
  unique(parsed.data.supervisors.flatMap((item) => item.ktp.kind === 'new' ? [item.ktp.fileId] : []), 'Satu file KTP tidak boleh digunakan untuk lebih dari satu Supervisor.')
  const stored = new Map(existing?.supervisors.map((item) => [item.supervisorId, item]) ?? [])

  const supervisors = await Promise.all(parsed.data.supervisors.map(async (item, index): Promise<ValidatedSupervisor> => {
    const previous = item.supervisorId ? stored.get(item.supervisorId) : undefined
    if (item.supervisorId && !previous) throw new ApiError(400, 'SUBMISSION_INVALID', 'Referensi Supervisor tersimpan tidak valid.')
    const idMdxl = item.idMdxl?.trim() ?? ''
    if (idMdxl) {
      if (item.source !== 'baseline' || item.ktp.kind !== 'not-required') throw new ApiError(400, 'SUBMISSION_INVALID', 'Supervisor baseline harus menggunakan identitas dan aturan KTP baseline.')
      if (previous && previous.idMdxl !== idMdxl) throw new ApiError(400, 'SUBMISSION_INVALID', 'ID MDXL Supervisor tersimpan tidak boleh diubah.')
      const master = await dependencies.getBaseline({
        namaDistributor: identity.distributor.namaDistributor, ap: identity.ap.ap,
        idMdxl, namaSupervisor: item.namaSupervisor,
      })
      return { supervisorId: item.supervisorId, idMdxl: master.idMdxl, namaSupervisor: master.fullname, ktpSource: 'not-required' }
    }
    if (item.source !== 'custom' || item.ktp.kind === 'not-required') throw new ApiError(400, 'KTP_INVALID', 'Supervisor custom wajib memiliki KTP yang valid.')
    let ktp: UploadedKtp
    if (item.ktp.kind === 'existing') {
      if (!previous?.ktp || previous.idMdxl) throw new ApiError(400, 'KTP_INVALID', 'KTP tersimpan bukan milik Supervisor custom ini.')
      ktp = await dependencies.verifyExistingKtp(previous.ktp.fileId, previous.ktp)
    } else {
      ktp = await dependencies.verifyNewKtp(item.ktp.fileId, {
        requestToken: parsed.data.requestToken,
        namaDistributor: identity.distributor.namaDistributor,
        ap: identity.ap.ap,
        supervisorNo: index + 1,
      })
      if (ktp.fileName !== item.ktp.fileName || ktp.mimeType !== item.ktp.mimeType || ktp.fileUrl !== item.ktp.fileUrl) {
        throw new ApiError(400, 'KTP_INVALID', 'Metadata KTP tidak sesuai dengan file Google Drive.')
      }
    }
    return { supervisorId: item.supervisorId, idMdxl: '', namaSupervisor: item.namaSupervisor, ktp, ktpSource: item.ktp.kind }
  }))
  unique(supervisors.flatMap((item) => item.ktp ? [item.ktp.fileId] : []), 'Satu file KTP tidak boleh digunakan untuk lebih dari satu Supervisor.')
  return { requestToken: parsed.data.requestToken, distributor: identity.distributor, ap: identity.ap, submissionAreaId: parsed.data.submissionAreaId, supervisors }
}

const cleanupEnvelopeSchema = z.object({
  requestToken: requestTokenSchema,
  supervisors: z.array(z.object({
    ktp: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('new'), fileId: driveFileId }).passthrough(),
      z.object({ kind: z.literal('existing') }).passthrough(),
      z.object({ kind: z.literal('not-required') }).passthrough(),
    ]),
  }).passthrough()),
}).passthrough()

export function extractCleanupCandidates(rawInput: unknown): { requestToken: string; fileIds: string[] } | null {
  const parsed = cleanupEnvelopeSchema.safeParse(rawInput)
  if (!parsed.success) return null
  return { requestToken: parsed.data.requestToken, fileIds: parsed.data.supervisors.flatMap((item) => item.ktp.kind === 'new' ? [item.ktp.fileId] : []) }
}
