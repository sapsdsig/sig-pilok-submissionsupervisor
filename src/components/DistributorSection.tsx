import { useController, useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import type { Distributor } from '../types/masterData'
import { FieldError } from './FieldError'
import { SearchableSelect } from './SearchableSelect'

type Props = {
  distributors: readonly Distributor[]
  isLoading: boolean
  loadError?: string
  lookupStatus: 'idle' | 'loading' | 'create' | 'edit' | 'error'
  onSelect: (namaDistributor: string) => void
  onRetry: () => void
}

export function DistributorSection(props: Props) {
  const { control } = useFormContext<SupervisorFormValues>()
  const distributor = useController({ control, name: 'namaDistributor' })
  const options = props.distributors.map((item) => ({
    value: item.namaDistributor,
    label: item.namaDistributor,
  }))
  const fieldId = 'nama-distributor'
  const errorId = 'nama-distributor-error'
  return (
    <section className='form-section'>
      <div className='section-heading'>
        <span className='step-badge'>1</span>
        <div>
          <h2>Informasi Distributor</h2>
          <p>Cari dan pilih Distributor yang tersedia pada master.</p>
        </div>
      </div>
      <label className='field-label mt-6' htmlFor={fieldId}>Distributor *</label>
      <SearchableSelect
        inputId={fieldId}
        ariaLabel='Distributor'
        fieldPath='namaDistributor'
        describedBy={distributor.fieldState.error ? errorId : undefined}
        value={distributor.field.value}
        options={options}
        placeholder='Cari distributor...'
        emptyMessage='Distributor tidak ditemukan.'
        loading={props.isLoading}
        disabled={props.lookupStatus === 'loading'}
        invalid={Boolean(distributor.fieldState.error)}
        onBlur={distributor.field.onBlur}
        onChange={props.onSelect}
      />
      <FieldError id={errorId} message={distributor.fieldState.error?.message} />
      {props.lookupStatus === 'loading' && <p className='mt-2 text-sm text-sky-700'>Memeriksa data tersimpan...</p>}
      {props.lookupStatus === 'create' && <p className='mt-2 text-sm text-emerald-700'>Data baru.</p>}
      {props.lookupStatus === 'edit' && <p className='mt-2 text-sm text-sky-800'>Data tersimpan ditemukan - Mode Edit.</p>}
      {props.loadError && (
        <p className='mt-2 text-sm text-red-700' role='alert'>
          {props.loadError}{' '}
          <button type='button' className='font-bold underline' onClick={props.onRetry}>Coba lagi</button>
        </p>
      )}
    </section>
  )
}
