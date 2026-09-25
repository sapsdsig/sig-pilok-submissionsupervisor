import { renderToString } from 'react-dom/server'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import type { SupervisorFormValues } from '../types/form'
import { SupervisorFields } from './SupervisorFields'

function Harness({ baseline = false }: { baseline?: boolean }) {
  const methods = useForm<SupervisorFormValues>({ defaultValues: {
    namaDistributor: 'VENDOR', ap: 'AP1', supervisors: baseline
      ? [{ source: 'baseline', idMdxl: '1453366', namaSupervisor: 'APRIFALDI', ktp: { kind: 'not-required' } }]
      : [{ source: 'custom', namaSupervisor: 'CUSTOM', ktp: { kind: 'existing' } }],
  } })
  return <FormProvider {...methods}><SupervisorFields supervisorIndex={0} canRemove onRemove={vi.fn()} /></FormProvider>
}
describe('SupervisorFields Phase 7', () => {
  it('shows baseline as readonly without exposing ID or KTP controls', () => {
    const html = renderToString(<Harness baseline />)
    expect(html).toContain('Data Q1 2026'); expect(html).toContain('readOnly'); expect(html).not.toContain('1453366'); expect(html).not.toContain('Pilih file KTP')
  })
  it('shows only private replacement state for saved custom KTP', () => {
    const html = renderToString(<Harness />)
    expect(html).toContain('KTP tersimpan'); expect(html).toContain('Ganti KTP'); expect(html).not.toContain('Lihat File'); expect(html).not.toContain('drive.google.com')
  })
})
