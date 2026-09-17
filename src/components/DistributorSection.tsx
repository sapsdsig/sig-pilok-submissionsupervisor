import { useController, useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import type { Distributor } from '../types/masterData'
import { FieldError } from './FieldError'
import { SectionCard, SectionHeader, StatusBanner } from './FormLayout'
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
    <SectionCard>
      <SectionHeader
        step={1}
        title='Informasi Distributor'
        description='Cari dan pilih Distributor yang tersedia pada master.'
      />
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
      <div className='mt-3 space-y-2'>
        {props.lookupStatus === 'loading' && (
          <StatusBanner variant='info' compact>
            Memeriksa data tersimpan...
          </StatusBanner>
        )}
        {props.lookupStatus === 'create' && (
          <StatusBanner variant='success' compact>
            Distributor siap untuk data baru.
          </StatusBanner>
        )}
        {props.lookupStatus === 'edit' && (
          <StatusBanner variant='info' compact>
            Data tersimpan ditemukan · Mode Edit.
          </StatusBanner>
        )}
        {props.loadError && (
          <StatusBanner
            variant='error'
            compact
            action={
              <button type='button' className='button-text' onClick={props.onRetry}>
                Coba lagi
              </button>
            }
          >
            {props.loadError}
          </StatusBanner>
        )}
      </div>
    </SectionCard>
  )
}
