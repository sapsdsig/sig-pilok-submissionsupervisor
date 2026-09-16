import { useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { FileUploadField } from './FileUploadField'

type SupervisorFieldsProps = {
  wilayahIndex: number
  supervisorIndex: number
}

export function SupervisorFields({
  wilayahIndex,
  supervisorIndex,
}: SupervisorFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<SupervisorFormValues>()
  const namePath = `wilayah.${wilayahIndex}.supervisors.${supervisorIndex}.namaSupervisor` as const
  const ktpPath = `wilayah.${wilayahIndex}.supervisors.${supervisorIndex}.ktp` as const
  const nameError = errors.wilayah?.[wilayahIndex]?.supervisors?.[supervisorIndex]?.namaSupervisor
  const nameId = `nama-supervisor-${wilayahIndex}-${supervisorIndex}`

  return (
    <div className="supervisor-panel">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
          {supervisorIndex + 1}
        </span>
        <h4 className="font-semibold text-slate-800">Supervisor {supervisorIndex + 1}</h4>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={nameId}>
            Nama Supervisor <span aria-hidden="true">*</span>
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            className={`text-input ${nameError ? 'input-error' : ''}`}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            placeholder="Masukkan nama lengkap"
            {...register(namePath)}
          />
          <FieldError id={`${nameId}-error`} message={nameError?.message} />
        </div>
        <FileUploadField
          inputId={`ktp-supervisor-${wilayahIndex}-${supervisorIndex}`}
          name={ktpPath}
        />
      </div>
    </div>
  )
}
