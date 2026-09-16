import { z } from 'zod'
import {
  MAX_KTP_FILE_SIZE_BYTES,
  MAX_KTP_FILE_SIZE_LABEL,
} from '../constants/files'
import type { KtpState } from '../types/form'
import type { AreaOption, ProvinceOption } from '../types/masterData'
import { isFileObject, isSupportedKtpFile } from '../utils/files'

export type SupervisorSchemaDependencies = {
  isKnownDistributor: (namaDistributor: string) => boolean
  getProvince: (provinsiName: string) => ProvinceOption | undefined
  getArea: (
    provinsiName: string,
    areaName: string,
  ) => AreaOption | undefined
}

const ktpStateSchema = z
  .custom<KtpState>(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      ('kind' in value) &&
      (value.kind === 'existing' || value.kind === 'new'),
    'KTP Supervisor wajib dipilih.',
  )
  .superRefine((ktp, context) => {
    if (!ktp) return
    if (ktp.kind === 'existing') {
      if (!ktp.fileId || !ktp.fileName || !ktp.fileUrl) {
        context.addIssue({
          code: 'custom',
          message: 'Referensi KTP tersimpan tidak valid.',
        })
      }
      return
    }
    if (!isFileObject(ktp.file)) {
      context.addIssue({
        code: 'custom',
        message: 'KTP Supervisor wajib dipilih.',
      })
      return
    }
    if (!isSupportedKtpFile(ktp.file)) {
      context.addIssue({
        code: 'custom',
        message: 'Format KTP harus JPG, JPEG, PNG, atau PDF.',
      })
    }
    if (ktp.file.size > MAX_KTP_FILE_SIZE_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `Ukuran KTP maksimal ${MAX_KTP_FILE_SIZE_LABEL}.`,
      })
    }
  })

const supervisorSchema = z.object({
  supervisorId: z.string().optional(),
  namaSupervisor: z
    .string()
    .trim()
    .min(1, 'Nama Supervisor wajib diisi.'),
  ktp: ktpStateSchema,
})

const wilayahSchema = z.object({
  submissionAreaId: z.string().optional(),
  provinsiName: z.string().min(1, 'Provinsi wajib dipilih.'),
  areaName: z.string().min(1, 'Area wajib dipilih.'),
  supervisors: z
    .array(supervisorSchema)
    .min(1, 'Minimal satu Supervisor harus tersedia.')
    .max(10, 'Jumlah Supervisor maksimal 10.'),
})

const normalize = (value: string) => value.trim().toLocaleUpperCase('id-ID')

export const createSupervisorFormSchema = (
  dependencies: SupervisorSchemaDependencies,
) =>
  z
    .object({
      namaDistributor: z.string().min(1, 'Distributor wajib dipilih.'),
      wilayah: z
        .array(wilayahSchema)
        .min(1, 'Minimal satu Wilayah Operasional harus diisi.'),
    })
    .superRefine((values, context) => {
      if (!dependencies.isKnownDistributor(values.namaDistributor)) {
        context.addIssue({
          code: 'custom',
          path: ['namaDistributor'],
          message: 'Distributor harus dipilih dari master.',
        })
      }

      const combinations = new Set<string>()
      values.wilayah.forEach((wilayah, wilayahIndex) => {
        const province = dependencies.getProvince(wilayah.provinsiName)
        if (
          wilayah.provinsiName &&
          (!province ||
            normalize(province.provinsiName) !==
              normalize(wilayah.provinsiName))
        ) {
          context.addIssue({
            code: 'custom',
            path: ['wilayah', wilayahIndex, 'provinsiName'],
            message: 'Provinsi tidak valid. Silakan pilih kembali.',
          })
        }

        const area = dependencies.getArea(
          wilayah.provinsiName,
          wilayah.areaName,
        )
        if (
          wilayah.areaName &&
          (!area || normalize(area.areaName) !== normalize(wilayah.areaName))
        ) {
          context.addIssue({
            code: 'custom',
            path: ['wilayah', wilayahIndex, 'areaName'],
            message: 'Area tidak sesuai dengan Provinsi yang dipilih.',
          })
        }

        if (wilayah.provinsiName && wilayah.areaName) {
          const combination = `${normalize(wilayah.provinsiName)}::${normalize(wilayah.areaName)}`
          if (combinations.has(combination)) {
            context.addIssue({
              code: 'custom',
              path: ['wilayah', wilayahIndex, 'areaName'],
              message: 'Kombinasi Provinsi dan Area sudah digunakan.',
            })
          }
          combinations.add(combination)
        }
      })
    })

export type SupervisorFormSchema = ReturnType<
  typeof createSupervisorFormSchema
>
