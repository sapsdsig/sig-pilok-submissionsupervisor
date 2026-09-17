import { zodResolver } from '@hookform/resolvers/zod'
import { createFormControl } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { mockProvinceAreaRows } from '../data/mockProvinceAreas'
import { MockDistributorService } from '../services/distributorService'
import { MockRegionService } from '../services/regionService'
import type { SupervisorFormValues } from '../types/form'
import { createEmptySupervisor } from '../types/form'
import { createSupervisorFormSchema } from './supervisorFormSchema'

const distributors = new MockDistributorService()
const regions = new MockRegionService(mockProvinceAreaRows)
const schema = createSupervisorFormSchema({
  isKnownDistributor: (name) => distributors.isKnownDistributor(name),
  getProvince: (name) => regions.getProvince(name),
  getArea: (province, area) => regions.getArea(province, area),
})

const validMasterSelection = (): SupervisorFormValues => ({
  namaDistributor: 'CENDRAWASIH MULIA PERKASA, PT',
  wilayah: [
    {
      provinsiName: 'ACEH',
      areaName: 'Area 02',
      supervisors: [createEmptySupervisor()],
    },
  ],
})

const createForm = (defaultValues = validMasterSelection()) => {
  const form = createFormControl<SupervisorFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  form.register('wilayah.0.supervisors.0.namaSupervisor')
  form.register('wilayah.0.supervisors.0.ktp')
  return form
}

describe('submit-first form validation UX', () => {
  it('does not expose required Supervisor errors before submit', () => {
    const form = createForm()

    expect(
      form.getFieldState('wilayah.0.supervisors.0.namaSupervisor').error,
    ).toBeUndefined()
    expect(
      form.getFieldState('wilayah.0.supervisors.0.ktp').error,
    ).toBeUndefined()
  })

  it('shows required errors on submit and clears a corrected field on change', async () => {
    const form = createForm()
    const onInvalid = vi.fn()

    await form.handleSubmit(vi.fn(), onInvalid)()

    expect(onInvalid).toHaveBeenCalledOnce()
    expect(
      form.getFieldState('wilayah.0.supervisors.0.namaSupervisor').error
        ?.message,
    ).toBe('Nama Supervisor wajib diisi.')
    expect(
      form.getFieldState('wilayah.0.supervisors.0.ktp').error?.message,
    ).toBe('KTP Supervisor wajib dipilih.')

    form.setValue(
      'wilayah.0.supervisors.0.namaSupervisor',
      'Budi Santoso',
      { shouldValidate: true },
    )

    await vi.waitFor(() => {
      expect(
        form.getFieldState('wilayah.0.supervisors.0.namaSupervisor').error,
      ).toBeUndefined()
    })
  })

  it('keeps a newly added blank Supervisor neutral before submit', () => {
    const form = createForm()
    form.setValue('wilayah.0.supervisors.1', createEmptySupervisor())
    form.register('wilayah.0.supervisors.1.namaSupervisor')
    form.register('wilayah.0.supervisors.1.ktp')

    expect(
      form.getFieldState('wilayah.0.supervisors.1.namaSupervisor').error,
    ).toBeUndefined()
    expect(
      form.getFieldState('wilayah.0.supervisors.1.ktp').error,
    ).toBeUndefined()
  })
})
