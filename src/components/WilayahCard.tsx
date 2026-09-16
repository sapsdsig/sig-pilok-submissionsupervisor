import { useCallback, useEffect, useState } from 'react'
import {
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form'
import type { ProvinceOption, AreaOption } from '../types/masterData'
import type { SupervisorFormValues } from '../types/form'
import type { RegionService } from '../services/regionService'
import { createEmptySupervisor } from '../types/form'
import { ConfirmationDialog } from './ConfirmationDialog'
import { FieldError } from './FieldError'
import { SupervisorFields } from './SupervisorFields'
import { TrashIcon } from './icons'

type WilayahCardProps = {
  index: number
  provinces: ProvinceOption[]
  regionService: RegionService
  canRemove: boolean
  onRemove: () => void
}

export function WilayahCard({
  index,
  provinces,
  regionService,
  canRemove,
  onRemove,
}: WilayahCardProps) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<SupervisorFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `wilayah.${index}.supervisors`,
  })
  const provinceId = useWatch({
    control,
    name: `wilayah.${index}.provinsiId`,
  })
  const provinceName = useWatch({
    control,
    name: `wilayah.${index}.provinsiName`,
  })
  const areaId = useWatch({
    control,
    name: `wilayah.${index}.areaId`,
  })
  const areaName = useWatch({
    control,
    name: `wilayah.${index}.areaName`,
  })
  const supervisorCount = useWatch({
    control,
    name: `wilayah.${index}.jumlahSupervisor`,
  })
  const [areas, setAreas] = useState<AreaOption[]>([])
  const [isLoadingAreas, setIsLoadingAreas] = useState(false)
  const [areaLoadError, setAreaLoadError] = useState<string>()
  const [areaRetry, setAreaRetry] = useState(0)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const wilayahErrors = errors.wilayah?.[index]

  useEffect(() => {
    let active = true

    if (!provinceId) {
      setAreas([])
      setIsLoadingAreas(false)
      setAreaLoadError(undefined)
      return () => {
        active = false
      }
    }

    setIsLoadingAreas(true)
    setAreaLoadError(undefined)
    void regionService
      .getAreasByProvince(provinceId)
      .then((options) => {
        if (active) setAreas(options)
      })
      .catch(() => {
        if (active) {
          setAreas([])
          setAreaLoadError('Area gagal dimuat. Silakan coba kembali.')
        }
      })
      .finally(() => {
        if (active) setIsLoadingAreas(false)
      })

    return () => {
      active = false
    }
  }, [areaRetry, provinceId, regionService])

  const setSupervisorCount = useCallback(
    (count: number) => {
      setValue(`wilayah.${index}.jumlahSupervisor`, count, {
        shouldDirty: true,
        shouldValidate: true,
      })
    },
    [index, setValue],
  )

  const removeSupervisorEntries = (nextCount: number) => {
    const indexes = Array.from(
      { length: fields.length - nextCount },
      (_, offset) => nextCount + offset,
    )
    remove(indexes)
    setSupervisorCount(nextCount)
  }

  const handleCountChange = (rawValue: string) => {
    if (rawValue === '') {
      setSupervisorCount(Number.NaN)
      return
    }

    const nextCount = Number(rawValue)
    if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > 10) {
      setSupervisorCount(nextCount)
      return
    }

    if (nextCount > fields.length) {
      append(
        Array.from({ length: nextCount - fields.length }, () =>
          createEmptySupervisor(),
        ),
      )
      setSupervisorCount(nextCount)
      return
    }

    if (nextCount < fields.length) {
      const entriesToRemove = getValues(
        `wilayah.${index}.supervisors`,
      ).slice(nextCount)
      const containsData = entriesToRemove.some(
        (entry) => entry.namaSupervisor.trim().length > 0 || entry.ktp !== null,
      )

      if (containsData) {
        setPendingCount(nextCount)
      } else {
        removeSupervisorEntries(nextCount)
      }
      return
    }

    setSupervisorCount(nextCount)
  }

  const handleProvinceChange = (selectedId: string) => {
    const province = provinces.find((item) => item.provinsiId === selectedId)
    setValue(`wilayah.${index}.provinsiId`, selectedId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(`wilayah.${index}.provinsiName`, province?.provinsiName ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(`wilayah.${index}.areaId`, '', {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(`wilayah.${index}.areaName`, '', { shouldDirty: true })
    setValue(`wilayah.${index}.areaAp`, '', { shouldDirty: true })
  }

  const handleAreaChange = (selectedId: string) => {
    const area = areas.find((item) => item.areaId === selectedId)
    setValue(`wilayah.${index}.areaId`, selectedId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(`wilayah.${index}.areaName`, area?.areaName ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue(`wilayah.${index}.areaAp`, area?.areaAp ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <article className="wilayah-card">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
            Wilayah {index + 1}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {provinceName && areaName
              ? `${provinceName} — ${areaName}`
              : 'Pilih Provinsi dan Area'}
          </h3>
        </div>
        <button
          type="button"
          className="icon-button text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Hapus Wilayah ${index + 1}`}
          title={canRemove ? 'Hapus wilayah' : 'Minimal satu wilayah harus tersedia'}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="field-label" htmlFor={`provinsi-${index}`}>
              Provinsi <span aria-hidden="true">*</span>
            </label>
            <select
              id={`provinsi-${index}`}
              className={`select-input ${wilayahErrors?.provinsiId ? 'input-error' : ''}`}
              value={provinceId}
              aria-invalid={Boolean(wilayahErrors?.provinsiId)}
              onChange={(event) => handleProvinceChange(event.target.value)}
            >
              <option value="">Pilih Provinsi</option>
              {provinces.map((province) => (
                <option key={province.provinsiId} value={province.provinsiId}>
                  {province.provinsiName}
                </option>
              ))}
            </select>
            <FieldError message={wilayahErrors?.provinsiId?.message} />
          </div>

          <div>
            <label className="field-label" htmlFor={`area-${index}`}>
              Area <span aria-hidden="true">*</span>
            </label>
            <select
              id={`area-${index}`}
              className={`select-input ${wilayahErrors?.areaId ? 'input-error' : ''}`}
              value={areaId}
              disabled={!provinceId || isLoadingAreas}
              aria-invalid={Boolean(wilayahErrors?.areaId)}
              onChange={(event) => handleAreaChange(event.target.value)}
            >
              <option value="">
                {isLoadingAreas
                  ? 'Memuat Area...'
                  : areaLoadError
                    ? 'Area gagal dimuat'
                    : provinceId && areas.length === 0
                      ? 'Tidak ada Area tersedia'
                  : provinceId
                    ? 'Pilih Area'
                    : 'Pilih Provinsi dahulu'}
              </option>
              {areas.map((area) => (
                <option key={area.areaId} value={area.areaId}>
                  {area.areaName}
                </option>
              ))}
            </select>
            {areaLoadError && (
              <button
                type="button"
                className="mt-1.5 text-xs font-bold text-red-700 underline"
                onClick={() => setAreaRetry((value) => value + 1)}
              >
                Coba muat kembali
              </button>
            )}
            {!isLoadingAreas &&
              !areaLoadError &&
              provinceId &&
              areas.length === 0 && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Provinsi ini belum memiliki Area pada master.
                </p>
              )}
            <FieldError message={wilayahErrors?.areaId?.message} />
          </div>

          <div>
            <label className="field-label" htmlFor={`jumlah-supervisor-${index}`}>
              Jumlah Supervisor <span aria-hidden="true">*</span>
            </label>
            <input
              id={`jumlah-supervisor-${index}`}
              type="number"
              min="1"
              max="10"
              step="1"
              inputMode="numeric"
              className={`text-input ${wilayahErrors?.jumlahSupervisor ? 'input-error' : ''}`}
              value={Number.isNaN(supervisorCount) ? '' : supervisorCount}
              aria-invalid={Boolean(wilayahErrors?.jumlahSupervisor)}
              onChange={(event) => handleCountChange(event.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-500">Minimal 1, maksimal 10 orang.</p>
            <FieldError message={wilayahErrors?.jumlahSupervisor?.message} />
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-6">
          {fields.map((field, supervisorIndex) => (
            <SupervisorFields
              key={field.id}
              wilayahIndex={index}
              supervisorIndex={supervisorIndex}
            />
          ))}
        </div>
      </div>

      <ConfirmationDialog
        open={pendingCount !== null}
        title="Kurangi jumlah Supervisor?"
        description={`Data Supervisor ${pendingCount === null ? '' : `${pendingCount + 1} sampai ${fields.length}`} sudah terisi. Jika dilanjutkan, nama dan file KTP pada data tersebut akan dihapus.`}
        confirmLabel="Ya, kurangi"
        onCancel={() => setPendingCount(null)}
        onConfirm={() => {
          if (pendingCount !== null) removeSupervisorEntries(pendingCount)
          setPendingCount(null)
        }}
      />
    </article>
  )
}
