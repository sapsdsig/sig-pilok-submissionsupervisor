import { zodResolver } from '@hookform/resolvers/zod'
import { createFormControl } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import type { SupervisorFormValues } from '../types/form'
import { createEmptySupervisor } from '../types/form'
import { createSupervisorFormSchema } from './supervisorFormSchema'

const schema = createSupervisorFormSchema({ isKnownDistributor: () => true, isKnownAp: () => true })
const createForm = () => {
  const form = createFormControl<SupervisorFormValues>({ resolver: zodResolver(schema), defaultValues: { namaDistributor: 'VENDOR', ap: 'AP1', supervisors: [createEmptySupervisor()] }, mode: 'onSubmit', reValidateMode: 'onChange' })
  form.register('supervisors.0.namaSupervisor'); form.register('supervisors.0.ktp')
  return form
}
describe('submit-first form validation UX', () => {
  it('stays neutral before submit and shows errors on submit', async () => {
    const form = createForm(); expect(form.getFieldState('supervisors.0.namaSupervisor').error).toBeUndefined()
    const invalid = vi.fn(); await form.handleSubmit(vi.fn(), invalid)()
    expect(invalid).toHaveBeenCalledOnce(); expect(form.getFieldState('supervisors.0.namaSupervisor').error?.message).toBe('Nama Supervisor wajib diisi.')
    expect(form.getFieldState('supervisors.0.ktp').error?.message).toBe('KTP Supervisor wajib dipilih.')
  })
})
