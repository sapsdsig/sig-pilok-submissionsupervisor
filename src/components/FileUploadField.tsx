import { useRef } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import { KTP_FILE_ACCEPT, MAX_KTP_FILE_SIZE_LABEL } from '../constants/files'
import type { ExistingKtp, SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { CheckIcon, TrashIcon, UploadIcon } from './icons'

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
    <div className='w-full min-w-0 max-w-full'>
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
        <div
          className='file-selected w-full min-w-0 max-w-full'
          tabIndex={-1}
          {...targetProps}
        >
          <div className='flex w-full min-w-0 max-w-full flex-1 items-center gap-3'>
            <span className='file-state-icon' aria-hidden='true'>
              <CheckIcon className='size-4' />
            </span>
            <div className='min-w-0 max-w-full flex-1'>
              <p
                className='block max-w-full truncate text-sm font-semibold'
                title={file.name}
              >
                {file.name}
              </p>
              <p className='text-xs text-slate-500'>
                File baru · {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <div className='file-actions'>
            <label htmlFor={props.inputId} className='button-text'>Ganti</label>
            <button
              type='button'
              className='icon-button icon-button-danger'
              onClick={clearNewFile}
              title='Hapus file baru'
            >
              <TrashIcon className='size-4' />
            </button>
          </div>
        </div>
      ) : existing ? (
        <div
          className='file-selected w-full min-w-0 max-w-full'
          tabIndex={-1}
          {...targetProps}
        >
          <div className='flex w-full min-w-0 max-w-full flex-1 items-center gap-3'>
            <span className='file-state-icon' aria-hidden='true'>
              <CheckIcon className='size-4' />
            </span>
            <div className='min-w-0 max-w-full flex-1'>
              <p className='text-xs text-slate-500'>KTP tersimpan</p>
              <p
                className='block max-w-full truncate text-sm font-semibold'
                title={existing.fileName}
              >
                {existing.fileName}
              </p>
            </div>
          </div>
          <div className='file-actions'>
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
          <UploadIcon className='size-7 text-sig-red' />
          <span className='text-sm font-semibold text-sig-ink'>Pilih file KTP</span>
          <span className='text-xs text-slate-500'>
            JPG, JPEG, PNG, atau PDF - maks. {MAX_KTP_FILE_SIZE_LABEL}
          </span>
        </label>
      )}
      <FieldError id={errorId} message={fieldState.error?.message} />
    </div>
  )
}
