import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { createEmptySupervisor, type SupervisorFormValues } from '../types/form'
import { ConfirmationDialog } from './ConfirmationDialog'
import { SupervisorFields } from './SupervisorFields'

export function WilayahCard() {
  const { control, getValues } = useFormContext<SupervisorFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'supervisors' })
  const [pendingSupervisor, setPendingSupervisor] = useState<number | null>(null)
  const requestRemoval = (index: number) => {
    if (fields.length <= 1) return
    const entry = getValues(`supervisors.${index}`)
    if (entry.supervisorId || entry.idMdxl || entry.namaSupervisor.trim() || entry.ktp) setPendingSupervisor(index)
    else remove(index)
  }
  return (
    <div className='min-w-0 space-y-4'>
      {fields.map((field, index) => <SupervisorFields key={field.id} supervisorIndex={index} canRemove={fields.length > 1} onRemove={() => requestRemoval(index)} />)}
      <button type='button' className='button-secondary w-full border-dashed sm:w-auto' disabled={fields.length >= 10} onClick={() => append(createEmptySupervisor())}>+ Tambah Supervisor</button>
      {fields.length >= 10 && <p className='text-xs text-slate-500'>Maksimal 10 Supervisor.</p>}
      <ConfirmationDialog open={pendingSupervisor !== null} title='Hapus Supervisor?' description='Data Supervisor akan dihapus setelah perubahan berhasil disimpan.' confirmLabel='Hapus Supervisor' onCancel={() => setPendingSupervisor(null)} onConfirm={() => { if (pendingSupervisor !== null) remove(pendingSupervisor); setPendingSupervisor(null) }} />
    </div>
  )
}
