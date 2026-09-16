import { z } from 'zod'
import { MAX_KTP_FILE_SIZE_BYTES, MAX_KTP_FILE_SIZE_LABEL } from '../constants/files'
import type { Distributor, AreaOption, ProvinceOption } from '../types/masterData'
import { isFileObject, isSupportedKtpFile } from '../utils/files'

export type SupervisorSchemaDependencies = {
  isKnownDistributor: (distributor: Distributor) => boolean
  getProvince: (provinsiId: string) => ProvinceOption | undefined
  getArea: (provinsiId: string, areaId: string) => AreaOption | undefined
}

const ktpFileSchema = z
  // `null` tetap menjadi bagian dari tipe state karena itu nilai awal input.
  // Predicate di bawah memastikan hanya File yang lolos saat submit.
  .custom<File | null>(isFileObject, 'KTP Supervisor wajib dipilih.')
  .superRefine((file, context) => {
    if (!isFileObject(file)) return

    if (!isSupportedKtpFile(file)) {
      context.addIssue({
        code: 'custom',
        message: 'Format KTP harus JPG, JPEG, PNG, atau PDF.',
      })
    }

    if (file.size > MAX_KTP_FILE_SIZE_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `Ukuran KTP maksimal ${MAX_KTP_FILE_SIZE_LABEL}.`,
      })
    }
  })

const supervisorSchema = z.object({
  namaSupervisor: z
    .string()
    .trim()
    .min(1, 'Nama Supervisor wajib diisi.'),
  ktp: ktpFileSchema,
})

const wilayahSchema = z.object({
  provinsiId: z.string().min(1, 'Provinsi wajib dipilih.'),
  provinsiName: z.string(),
  areaId: z.string().min(1, 'Area wajib dipilih.'),
  areaName: z.string(),
  areaAp: z.string(),
  jumlahSupervisor: z
    .number('Jumlah Supervisor wajib diisi dengan angka.')
    .int('Jumlah Supervisor harus berupa bilangan bulat.')
    .min(1, 'Jumlah Supervisor minimal 1.')
    .max(10, 'Jumlah Supervisor maksimal 10.'),
  supervisors: z.array(supervisorSchema),
})

export const createSupervisorFormSchema = (
  dependencies: SupervisorSchemaDependencies,
) =>
  z
    .object({
      kodeDistributor: z.string().min(1, 'Kode Distributor wajib diisi.'),
      namaDistributor: z.string().min(1, 'Cari Kode Distributor terlebih dahulu.'),
      distributorTerverifikasi: z
        .object({
          kodeDistributor: z.string(),
          namaDistributor: z.string(),
        })
        .nullable(),
      wilayah: z
        .array(wilayahSchema)
        .min(1, 'Minimal satu Wilayah Operasional harus diisi.'),
    })
    .superRefine((values, context) => {
      const resolved = values.distributorTerverifikasi
      const distributorIsValid =
        resolved !== null &&
        resolved.kodeDistributor === values.kodeDistributor &&
        resolved.namaDistributor === values.namaDistributor &&
        dependencies.isKnownDistributor(resolved)

      if (!distributorIsValid) {
        context.addIssue({
          code: 'custom',
          path: ['kodeDistributor'],
          message: 'Kode Distributor harus berhasil dicari sebelum melanjutkan.',
        })
      }

      const combinations = new Set<string>()

      values.wilayah.forEach((wilayah, wilayahIndex) => {
        const province = dependencies.getProvince(wilayah.provinsiId)
        if (
          wilayah.provinsiId &&
          (!province || province.provinsiName !== wilayah.provinsiName)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['wilayah', wilayahIndex, 'provinsiId'],
            message: 'Provinsi tidak valid. Silakan pilih kembali.',
          })
        }

        const area = dependencies.getArea(
          wilayah.provinsiId,
          wilayah.areaId,
        )
        if (
          wilayah.areaId &&
          (!area ||
            area.areaName !== wilayah.areaName ||
            area.areaAp !== wilayah.areaAp)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['wilayah', wilayahIndex, 'areaId'],
            message: 'Area tidak sesuai dengan Provinsi yang dipilih.',
          })
        }

        if (wilayah.provinsiId && wilayah.areaId) {
          const combination = `${wilayah.provinsiId}::${wilayah.areaId}`
          if (combinations.has(combination)) {
            context.addIssue({
              code: 'custom',
              path: ['wilayah', wilayahIndex, 'areaId'],
              message: 'Kombinasi Provinsi dan Area sudah digunakan.',
            })
          }
          combinations.add(combination)
        }

        if (wilayah.supervisors.length !== wilayah.jumlahSupervisor) {
          context.addIssue({
            code: 'custom',
            path: ['wilayah', wilayahIndex, 'jumlahSupervisor'],
            message: 'Jumlah data Supervisor belum sesuai.',
          })
        }
      })
    })

export type SupervisorFormSchema = ReturnType<
  typeof createSupervisorFormSchema
>
