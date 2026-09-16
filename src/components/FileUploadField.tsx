import { useRef } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import { KTP_FILE_ACCEPT, MAX_KTP_FILE_SIZE_LABEL } from '../constants/files'
import type { SupervisorFormValues } from '../types/form'
import { FieldError } from './FieldError'
import { TrashIcon, UploadIcon } from './icons'

type KtpFieldPath = `wilayah.${number}.supervisors.${number}.ktp`

type FileUploadFieldProps = {
  name: KtpFieldPath
  inputId: string
}

export function FileUploadField({ name, inputId }: FileUploadFieldProps) {
  const { control } = useFormContext<SupervisorFormValues>()
  const { field, fieldState } = useController({ control, name })
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedFile = field.value
  const errorId = `${inputId}-error`

  const clearFile = () => {
    field.onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <span className="field-label">
        Upload KTP Supervisor <span aria-hidden="true">*</span>
      </span>
      <input
        ref={inputRef}
        id={inputId}
        name={field.name}
        className="sr-only"
        type="file"
        accept={KTP_FILE_ACCEPT}
        aria-describedby={`${inputId}-hint${fieldState.error ? ` ${errorId}` : ''}`}
        aria-invalid={Boolean(fieldState.error)}
        onBlur={field.onBlur}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          field.onChange(file)
          // Nilai DOM dikosongkan; File tetap berada di RHF state. Dengan begitu
          // pengguna juga dapat memilih ulang file yang sama untuk menggantinya.
          event.target.value = ''
        }}
      />

      {selectedFile ? (
        <div className={`file-selected ${fieldState.error ? 'border-red-300 bg-red-50/40' : ''}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <UploadIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <label htmlFor={inputId} className="button-text cursor-pointer">
              Ganti
            </label>
            <button
              type="button"
              className="icon-button text-red-600 hover:bg-red-50"
              aria-label={`Hapus file ${selectedFile.name}`}
              onClick={clearFile}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`upload-box ${fieldState.error ? 'border-red-400 bg-red-50/40' : ''}`}
        >
          <UploadIcon className="size-7 text-sky-700" />
          <span className="text-sm font-semibold text-sky-800">Pilih file KTP</span>
          <span id={`${inputId}-hint`} className="text-xs text-slate-500">
            JPG, JPEG, PNG, atau PDF · maks. {MAX_KTP_FILE_SIZE_LABEL}
          </span>
        </label>
      )}

      <FieldError id={errorId} message={fieldState.error?.message} />
    </div>
  )
}
