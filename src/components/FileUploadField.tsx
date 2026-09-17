import { useRef } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import { KTP_FILE_ACCEPT, MAX_KTP_FILE_SIZE_LABEL } from '../constants/files'
import type { ExistingKtp, SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { TrashIcon, UploadIcon } from './icons'

type KtpFieldPath = `wilayah.${number}.supervisors.${number}.ktp`

export function FileUploadField(props: {
  name: KtpFieldPath
  inputId: string
}) {
  const { control } = useFormContext<SupervisorFormValues>()
  const { field, fieldState } = useController({ control, name: props.name })
  const inputRef = useRef<HTMLInputElement>(null)
  const ktp = field.value
  const existing: ExistingKtp | undefined =
    ktp?.kind === 'existing' ? ktp : ktp?.previous
  const file = ktp?.kind === 'new' ? ktp.file : undefined
  const errorId = `${props.inputId}-error`
  const targetProps = {
    'aria-invalid': Boolean(fieldState.error),
    'aria-describedby': fieldState.error ? errorId : undefined,
    'data-field-path': props.name,
  }

  const clearNewFile = () => {
    field.onChange(existing ?? null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <span className='field-label'>KTP Supervisor *</span>
      <input
        ref={inputRef}
        id={props.inputId}
        className='sr-only'
        type='file'
        accept={KTP_FILE_ACCEPT}
        aria-invalid={Boolean(fieldState.error)}
        aria-describedby={fieldState.error ? errorId : undefined}
        onBlur={field.onBlur}
        onChange={(event) => {
          const selected = event.target.files?.[0]
          if (selected) {
            field.onChange({ kind: 'new', file: selected, previous: existing })
          }
          event.target.value = ''
        }}
      />
      {file ? (
        <div className='file-selected' tabIndex={-1} {...targetProps}>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{file.name}</p>
            <p className='text-xs text-slate-500'>
              File baru - {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <div className='flex items-center gap-1'>
            <label htmlFor={props.inputId} className='button-text'>Ganti</label>
            <button type='button' className='icon-button text-red-600' onClick={clearNewFile}>
              <TrashIcon className='size-4' />
            </button>
          </div>
        </div>
      ) : existing ? (
        <div className='file-selected' tabIndex={-1} {...targetProps}>
          <div className='min-w-0'>
            <p className='text-xs text-slate-500'>KTP tersimpan:</p>
            <p className='truncate text-sm font-semibold'>{existing.fileName}</p>
          </div>
          <div className='flex items-center gap-1'>
            <a className='button-text' href={existing.fileUrl} target='_blank' rel='noreferrer'>Lihat File</a>
            <label htmlFor={props.inputId} className='button-text'>Ganti KTP</label>
          </div>
        </div>
      ) : (
        <label
          htmlFor={props.inputId}
          className={`upload-box ${fieldState.error ? 'border-red-400 bg-red-50/40' : ''}`}
          role='button'
          tabIndex={0}
          {...targetProps}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
        >
          <UploadIcon className='size-7 text-sky-700' />
          <span className='text-sm font-semibold text-sky-800'>Pilih file KTP</span>
          <span className='text-xs text-slate-500'>
            JPG, JPEG, PNG, atau PDF - maks. {MAX_KTP_FILE_SIZE_LABEL}
          </span>
        </label>
      )}
      <FieldError id={errorId} message={fieldState.error?.message} />
    </div>
  )
}
