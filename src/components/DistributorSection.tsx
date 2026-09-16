import { useController, useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import { CheckIcon, SearchIcon } from './icons'
import { FieldError } from './FieldError'

type DistributorSectionProps = {
  isSearching: boolean
  isResolved: boolean
  onLookup: () => void
  onCodeChanged: () => void
}

export function DistributorSection({
  isSearching,
  isResolved,
  onLookup,
  onCodeChanged,
}: DistributorSectionProps) {
  const { control } = useFormContext<SupervisorFormValues>()
  const code = useController({ control, name: 'kodeDistributor' })
  const name = useController({ control, name: 'namaDistributor' })

  return (
    <section className="form-section" aria-labelledby="distributor-heading">
      <div className="section-heading">
        <span className="step-badge">1</span>
        <div>
          <h2 id="distributor-heading">Informasi Distributor</h2>
          <p>Masukkan kode sesuai master distributor, termasuk angka nol di depan.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="kode-distributor">
            Kode Distributor <span aria-hidden="true">*</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="kode-distributor"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={`text-input min-w-0 flex-1 ${code.fieldState.error ? 'input-error' : ''}`}
              aria-invalid={Boolean(code.fieldState.error)}
              aria-describedby={code.fieldState.error ? 'kode-distributor-error' : undefined}
              placeholder="Contoh: 0000000971"
              value={code.field.value}
              name={code.field.name}
              ref={code.field.ref}
              onBlur={code.field.onBlur}
              onChange={(event) => {
                code.field.onChange(event)
                onCodeChanged()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onLookup()
                }
              }}
            />
            <button
              type="button"
              className="button-primary shrink-0"
              disabled={isSearching}
              onClick={onLookup}
            >
              <SearchIcon />
              {isSearching ? 'Mencari...' : 'Cari Distributor'}
            </button>
          </div>
          <FieldError id="kode-distributor-error" message={code.fieldState.error?.message} />
        </div>

        <div>
          <label className="field-label" htmlFor="nama-distributor">
            Nama Distributor
          </label>
          <div className="relative">
            <input
              id="nama-distributor"
              type="text"
              readOnly
              tabIndex={-1}
              className="text-input bg-slate-50 pr-11 text-slate-700"
              placeholder="Terisi setelah kode ditemukan"
              {...name.field}
            />
            {isResolved && (
              <CheckIcon className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-emerald-600" />
            )}
          </div>
          {isResolved && (
            <p className="mt-1.5 text-sm font-medium text-emerald-700">
              Distributor ditemukan dan terverifikasi.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
