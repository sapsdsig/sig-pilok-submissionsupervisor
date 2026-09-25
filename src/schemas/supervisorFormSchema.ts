import { z } from 'zod'
import { MAX_KTP_FILE_SIZE_BYTES, MAX_KTP_FILE_SIZE_LABEL } from '../constants/files'
import type { KtpState } from '../types/form'
import { isFileObject, isSupportedKtpFile } from '../utils/files'

export type SupervisorSchemaDependencies = {
  isKnownDistributor: (namaDistributor: string) => boolean
  isKnownAp: (namaDistributor: string, ap: string) => boolean
}

const customKtpSchema = z.custom<KtpState>((value) => {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false
  return value.kind === 'existing' || value.kind === 'new'
}, 'KTP Supervisor wajib dipilih.').superRefine((ktp, context) => {
  if (!ktp || ktp.kind !== 'new') return
  if (!isFileObject(ktp.file)) {
    context.addIssue({ code: 'custom', message: 'KTP Supervisor wajib dipilih.' })
  } else {
    if (!isSupportedKtpFile(ktp.file)) context.addIssue({ code: 'custom', message: 'Format KTP harus JPG, JPEG, PNG, atau PDF.' })
    if (ktp.file.size > MAX_KTP_FILE_SIZE_BYTES) context.addIssue({ code: 'custom', message: `Ukuran KTP maksimal ${MAX_KTP_FILE_SIZE_LABEL}.` })
  }
})

const baselineKtpSchema = z.custom<KtpState>(
  (value) => typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'not-required',
  'KTP baseline tidak diperlukan.',
)

const supervisorSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('baseline'),
    supervisorId: z.string().optional(),
    idMdxl: z.string().min(1),
    namaSupervisor: z.string().trim().min(1, 'Nama Supervisor wajib diisi.'),
    ktp: baselineKtpSchema,
  }),
  z.object({
    source: z.literal('custom'),
    supervisorId: z.string().optional(),
    idMdxl: z.string().optional(),
    namaSupervisor: z.string().trim().min(1, 'Nama Supervisor wajib diisi.'),
    ktp: customKtpSchema,
  }),
])

export const createSupervisorFormSchema = (dependencies: SupervisorSchemaDependencies) =>
  z.object({
    namaDistributor: z.string().min(1, 'Distributor wajib dipilih.'),
    ap: z.string().min(1, 'AP wajib dipilih.'),
    submissionAreaId: z.string().optional(),
    supervisors: z.array(supervisorSchema)
      .min(1, 'Minimal satu Supervisor harus tersedia.')
      .max(10, 'Jumlah Supervisor maksimal 10.'),
  }).superRefine((values, context) => {
    if (!dependencies.isKnownDistributor(values.namaDistributor)) {
      context.addIssue({ code: 'custom', path: ['namaDistributor'], message: 'Distributor harus dipilih dari master.' })
    }
    if (values.ap && !dependencies.isKnownAp(values.namaDistributor, values.ap)) {
      context.addIssue({ code: 'custom', path: ['ap'], message: 'AP harus dipilih dari master Distributor.' })
    }
    const ids = new Set<string>()
    values.supervisors.forEach((supervisor, index) => {
      if (supervisor.source === 'custom' && supervisor.idMdxl) {
        context.addIssue({ code: 'custom', path: ['supervisors', index, 'idMdxl'], message: 'Supervisor custom tidak boleh memiliki ID MDXL.' })
      }
      if (supervisor.idMdxl) {
        const key = supervisor.idMdxl.trim().toLocaleUpperCase('id-ID')
        if (ids.has(key)) context.addIssue({ code: 'custom', path: ['supervisors', index, 'idMdxl'], message: 'Supervisor baseline tidak boleh duplikat.' })
        ids.add(key)
      }
    })
  })

export type SupervisorFormSchema = ReturnType<typeof createSupervisorFormSchema>
