import { useController, useFormContext } from 'react-hook-form'
import type { SupervisorFormValues } from '../types/form'
import type { ApOption, Distributor } from '../types/masterData'
import { FieldError } from './FieldError'
import { SectionCard, SectionHeader, StatusBanner } from './FormLayout'
import { SearchableSelect } from './SearchableSelect'

type Props = {
  distributors: readonly Distributor[]
  apOptions: readonly ApOption[]
  isLoading: boolean
  isLoadingAp: boolean
  loadError?: string
  lookupStatus: 'idle' | 'loading' | 'create' | 'edit' | 'error'
  onSelectDistributor: (value: string) => void
  onSelectAp: (value: string) => void
  onRetry: () => void
}

export function DistributorSection(props: Props) {
  const { control } = useFormContext<SupervisorFormValues>()
  const distributor = useController({ control, name: 'namaDistributor' })
  const ap = useController({ control, name: 'ap' })
  return (
    <SectionCard>
      <SectionHeader step={1} title='Informasi Distributor' description='Pilih Distributor dan AP yang terdaftar pada master Q1 2026.' />
      <div className='mt-6 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2'>
        <div className='min-w-0'>
          <label className='field-label' htmlFor='nama-distributor'>Distributor *</label>
          <SearchableSelect inputId='nama-distributor' ariaLabel='Distributor' fieldPath='namaDistributor'
            describedBy={distributor.fieldState.error ? 'nama-distributor-error' : undefined}
            value={distributor.field.value} options={props.distributors.map((item) => ({ value: item.namaDistributor, label: item.namaDistributor }))}
            placeholder='Cari distributor...' emptyMessage='Distributor tidak ditemukan.' loading={props.isLoading}
            disabled={props.lookupStatus === 'loading'} invalid={Boolean(distributor.fieldState.error)} onBlur={distributor.field.onBlur} onChange={props.onSelectDistributor} />
          <FieldError id='nama-distributor-error' message={distributor.fieldState.error?.message} />
        </div>
        <div className='min-w-0'>
          <label className='field-label' htmlFor='ap'>AP *</label>
          <SearchableSelect inputId='ap' ariaLabel='AP' fieldPath='ap' describedBy={ap.fieldState.error ? 'ap-error' : undefined}
            value={ap.field.value} options={props.apOptions.map((item) => ({ value: item.ap, label: item.ap }))}
            placeholder={!distributor.field.value ? 'Pilih Distributor dahulu' : props.apOptions.length === 1 ? 'AP dipilih otomatis' : 'Pilih AP...'}
            emptyMessage='AP tidak ditemukan.' loading={props.isLoadingAp} disabled={!distributor.field.value || props.isLoadingAp || props.apOptions.length === 1 || props.lookupStatus === 'loading'}
            invalid={Boolean(ap.fieldState.error)} onBlur={ap.field.onBlur} onChange={props.onSelectAp} />
          <FieldError id='ap-error' message={ap.fieldState.error?.message} />
        </div>
      </div>
      <div className='mt-3 space-y-2'>
        {props.lookupStatus === 'loading' && <StatusBanner variant='info' compact>Memeriksa data Distributor + AP...</StatusBanner>}
        {props.lookupStatus === 'create' && <StatusBanner variant='success' compact>Baseline Q1 2026 siap diperbarui.</StatusBanner>}
        {props.lookupStatus === 'edit' && <StatusBanner variant='info' compact>Data tersimpan ditemukan · Mode Edit.</StatusBanner>}
        {props.loadError && <StatusBanner variant='error' compact action={<button type='button' className='button-text' onClick={props.onRetry}>Coba lagi</button>}>{props.loadError}</StatusBanner>}
      </div>
    </SectionCard>
  )
}
