import { useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { FileUploadField } from './FileUploadField'
import { TrashIcon } from './icons'

type Props = { supervisorIndex: number; canRemove: boolean; onRemove: () => void }

export function SupervisorFields(props: Props) {
  const { register, watch, formState: { errors } } = useFormContext<SupervisorFormValues>()
  const supervisor = watch(`supervisors.${props.supervisorIndex}`)
  const namePath = `supervisors.${props.supervisorIndex}.namaSupervisor` as const
  const ktpPath = `supervisors.${props.supervisorIndex}.ktp` as const
  const nameError = errors.supervisors?.[props.supervisorIndex]?.namaSupervisor
  const nameId = `nama-supervisor-${props.supervisorIndex}`
  const nameErrorId = `${nameId}-error`
  const baseline = supervisor?.source === 'baseline'

  return (
    <div className='supervisor-panel w-full min-w-0 max-w-full'>
      <div className='mb-4 flex min-w-0 items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800'>{props.supervisorIndex + 1}</span>
          <h4 className='min-w-0 truncate font-semibold text-slate-800'>Supervisor {props.supervisorIndex + 1}</h4>
          {baseline && <span className='rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600'>Data Q1 2026</span>}
        </div>
        <button type='button' className='icon-button icon-button-danger shrink-0 disabled:opacity-30' disabled={!props.canRemove} title={props.canRemove ? 'Hapus Supervisor' : 'Minimal satu Supervisor'} onClick={props.onRemove}>
          <TrashIcon className='size-4' />
        </button>
      </div>
      <div className={`grid w-full min-w-0 grid-cols-1 gap-5 ${baseline ? '' : 'lg:grid-cols-2'}`}>
        <div className='w-full min-w-0 max-w-full'>
          <label className='field-label' htmlFor={nameId}>Nama Supervisor *</label>
          <input id={nameId} type='text' autoComplete='name' readOnly={baseline}
            className={`text-input min-w-0 max-w-full ${baseline ? 'bg-slate-50 text-slate-700' : ''} ${nameError ? 'input-error' : ''}`}
            aria-invalid={Boolean(nameError)} aria-describedby={nameError ? nameErrorId : undefined}
            data-field-path={namePath} placeholder='Masukkan nama lengkap' {...register(namePath)} />
          <FieldError id={nameErrorId} message={nameError?.message} />
        </div>
        {!baseline && <FileUploadField inputId={`ktp-supervisor-${props.supervisorIndex}`} name={ktpPath} />}
      </div>
    </div>
  )
}
