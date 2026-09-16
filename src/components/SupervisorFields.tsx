import { useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { FileUploadField } from './FileUploadField'
import { TrashIcon } from './icons'

type Props = {
  wilayahIndex: number
  supervisorIndex: number
  canRemove: boolean
  onRemove: () => void
}

export function SupervisorFields(props: Props) {
  const {
    register,
    formState: { errors },
  } = useFormContext<SupervisorFormValues>()
  const namePath =
    `wilayah.${props.wilayahIndex}.supervisors.${props.supervisorIndex}.namaSupervisor` as const
  const ktpPath =
    `wilayah.${props.wilayahIndex}.supervisors.${props.supervisorIndex}.ktp` as const
  const nameError =
    errors.wilayah?.[props.wilayahIndex]?.supervisors?.[props.supervisorIndex]
      ?.namaSupervisor
  const nameId = `nama-supervisor-${props.wilayahIndex}-${props.supervisorIndex}`

  return (
    <div className='supervisor-panel'>
      <div className='mb-4 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <span className='flex size-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800'>
            {props.supervisorIndex + 1}
          </span>
          <h4 className='font-semibold text-slate-800'>
            Supervisor {props.supervisorIndex + 1}
          </h4>
        </div>
        <button
          type='button'
          className='icon-button text-red-600 disabled:opacity-30'
          disabled={!props.canRemove}
          title={props.canRemove ? 'Hapus Supervisor' : 'Minimal satu Supervisor'}
          onClick={props.onRemove}
        >
          <TrashIcon className='size-4' />
        </button>
      </div>
      <div className='grid gap-5 lg:grid-cols-2'>
        <div>
          <label className='field-label' htmlFor={nameId}>Nama Supervisor *</label>
          <input
            id={nameId}
            type='text'
            autoComplete='name'
            className={`text-input ${nameError ? 'input-error' : ''}`}
            placeholder='Masukkan nama lengkap'
            {...register(namePath)}
          />
          <FieldError message={nameError?.message} />
        </div>
        <FileUploadField
          inputId={`ktp-supervisor-${props.wilayahIndex}-${props.supervisorIndex}`}
          name={ktpPath}
        />
      </div>
    </div>
  )
}
