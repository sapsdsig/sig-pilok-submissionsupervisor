import { useEffect, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import type { RegionService } from '../services/regionService'
import {
  createEmptySupervisor,
  type SupervisorFormValues,
} from '../types/form'
import type { AreaOption, ProvinceOption } from '../types/masterData'
import { ConfirmationDialog } from './ConfirmationDialog'
import { FieldError } from './FieldError'
import { SearchableSelect } from './SearchableSelect'
import { SupervisorFields } from './SupervisorFields'
import { TrashIcon } from './icons'

type Props = {
  index: number
  provinces: ProvinceOption[]
  regionService: RegionService
  canRemove: boolean
  onRemove: () => void
}

export function WilayahCard(props: Props) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors, submitCount },
  } = useFormContext<SupervisorFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `wilayah.${props.index}.supervisors`,
  })
  const provinceName = useWatch({
    control,
    name: `wilayah.${props.index}.provinsiName`,
  })
  const areaName = useWatch({
    control,
    name: `wilayah.${props.index}.areaName`,
  })
  const [areas, setAreas] = useState<AreaOption[]>([])
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [areaError, setAreaError] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [pendingSupervisor, setPendingSupervisor] = useState<number | null>(null)
  const wilayahErrors = errors.wilayah?.[props.index]
  const provinceId = `provinsi-${props.index}`
  const areaId = `area-${props.index}`
  const provinceErrorId = `${provinceId}-error`
  const areaErrorId = `${areaId}-error`

  useEffect(() => {
    let active = true
    if (!provinceName) {
      setAreas([])
      setAreaError(undefined)
      return
    }
    setLoadingAreas(true)
    setAreaError(undefined)
    void props.regionService
      .getAreasByProvince(provinceName)
      .then((items) => {
        if (active) setAreas(items)
      })
      .catch(() => {
        if (active) {
          setAreas([])
          setAreaError('Area gagal dimuat. Silakan coba kembali.')
        }
      })
      .finally(() => {
        if (active) setLoadingAreas(false)
      })
    return () => {
      active = false
    }
  }, [provinceName, props.regionService, retry])

  const changeProvince = (value: string) => {
    const canonical =
      props.provinces.find((item) => item.provinsiName === value)
        ?.provinsiName ?? ''
    setValue(`wilayah.${props.index}.provinsiName`, canonical, {
      shouldDirty: true,
      shouldValidate: submitCount > 0,
    })
    setValue(`wilayah.${props.index}.areaName`, '', {
      shouldDirty: true,
      shouldValidate: submitCount > 0,
    })
  }

  const requestSupervisorRemoval = (supervisorIndex: number) => {
    if (fields.length <= 1) return
    const entry = getValues(
      `wilayah.${props.index}.supervisors.${supervisorIndex}`,
    )
    if (
      entry.supervisorId ||
      entry.namaSupervisor.trim() ||
      entry.ktp
    ) {
      setPendingSupervisor(supervisorIndex)
    } else {
      remove(supervisorIndex)
    }
  }

  return (
    <article className='wilayah-card'>
      <div className='flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6'>
        <div>
          <p className='text-xs font-bold uppercase tracking-wider text-sky-700'>
            Wilayah {props.index + 1}
          </p>
          <h3 className='mt-1 text-lg font-semibold'>
            {provinceName && areaName
              ? `${provinceName} - ${areaName}`
              : 'Pilih Provinsi dan Area'}
          </h3>
        </div>
        <button
          type='button'
          className='icon-button text-slate-500 disabled:opacity-30'
          disabled={!props.canRemove}
          onClick={props.onRemove}
          title={props.canRemove ? 'Hapus Wilayah' : 'Minimal satu Wilayah'}
        >
          <TrashIcon />
        </button>
      </div>

      <div className='space-y-6 p-5 sm:p-6'>
        <div className='grid gap-5 md:grid-cols-2'>
          <div>
            <label className='field-label' htmlFor={provinceId}>Provinsi *</label>
            <SearchableSelect
              inputId={provinceId}
              ariaLabel={`Provinsi Wilayah ${props.index + 1}`}
              fieldPath={`wilayah.${props.index}.provinsiName`}
              describedBy={wilayahErrors?.provinsiName ? provinceErrorId : undefined}
              value={provinceName}
              options={props.provinces.map((item) => ({
                value: item.provinsiName,
                label: item.provinsiName,
              }))}
              placeholder='Cari Provinsi...'
              emptyMessage='Provinsi tidak ditemukan.'
              invalid={Boolean(wilayahErrors?.provinsiName)}
              onChange={changeProvince}
            />
            <FieldError id={provinceErrorId} message={wilayahErrors?.provinsiName?.message} />
          </div>
          <div>
            <label className='field-label' htmlFor={areaId}>Area *</label>
            <SearchableSelect
              inputId={areaId}
              ariaLabel={`Area Wilayah ${props.index + 1}`}
              fieldPath={`wilayah.${props.index}.areaName`}
              describedBy={wilayahErrors?.areaName ? areaErrorId : undefined}
              value={areaName}
              options={areas.map((item) => ({
                value: item.areaName,
                label: item.areaName,
              }))}
              placeholder={provinceName ? 'Cari Area...' : 'Pilih Provinsi dahulu'}
              emptyMessage='Area tidak ditemukan.'
              loading={loadingAreas}
              disabled={!provinceName || loadingAreas}
              invalid={Boolean(wilayahErrors?.areaName)}
              onChange={(value) =>
                setValue(`wilayah.${props.index}.areaName`, value, {
                  shouldDirty: true,
                  shouldValidate: submitCount > 0,
                })
              }
            />
            <FieldError id={areaErrorId} message={wilayahErrors?.areaName?.message} />
            {areaError && (
              <button type='button' className='text-xs text-red-700 underline' onClick={() => setRetry((value) => value + 1)}>
                {areaError} Coba lagi
              </button>
            )}
          </div>
        </div>

        <div className='space-y-4 border-t border-slate-200 pt-6'>
          {fields.map((field, supervisorIndex) => (
            <SupervisorFields
              key={field.id}
              wilayahIndex={props.index}
              supervisorIndex={supervisorIndex}
              canRemove={fields.length > 1}
              onRemove={() => requestSupervisorRemoval(supervisorIndex)}
            />
          ))}
          <button
            type='button'
            className='button-secondary w-full border-dashed sm:w-auto'
            disabled={fields.length >= 10}
            onClick={() => append(createEmptySupervisor())}
          >
            + Tambah Supervisor
          </button>
          {fields.length >= 10 && (
            <p className='text-xs text-slate-500'>Maksimal 10 Supervisor per Wilayah.</p>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={pendingSupervisor !== null}
        title='Hapus Supervisor?'
        description='Data Supervisor akan dihapus setelah perubahan berhasil disimpan.'
        confirmLabel='Hapus Supervisor'
        onCancel={() => setPendingSupervisor(null)}
        onConfirm={() => {
          if (pendingSupervisor !== null) remove(pendingSupervisor)
          setPendingSupervisor(null)
        }}
      />
    </article>
  )
}
