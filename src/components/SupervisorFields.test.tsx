import { renderToString } from 'react-dom/server'
import { FormProvider, useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import type { SupervisorFormValues } from '../types/form'
import { SupervisorFields } from './SupervisorFields'

const longSupervisorName =
  'MUHAMMAD FARHAN ABDURRAHMAN PUTERA WIRAJAYA'
const longFileName =
  'KTP_ABADI_PUTERA_WIRAJAYA_PT_AREA_01_BANDA_ACEH_SUPERVISOR_01_20260917.pdf'

function ExistingKtpHarness() {
  const methods = useForm<SupervisorFormValues>({
    defaultValues: {
      namaDistributor: 'ABADI PUTERA',
      wilayah: [
        {
          provinsiName: 'ACEH',
          areaName: 'Area 01',
          supervisors: [
            {
              namaSupervisor: longSupervisorName,
              ktp: {
                kind: 'existing',
              },
            },
          ],
        },
      ],
    },
  })

  return (
    <FormProvider {...methods}>
      <SupervisorFields
        wilayahIndex={0}
        supervisorIndex={0}
        canRemove
        onRemove={vi.fn()}
      />
    </FormProvider>
  )
}

function NewKtpHarness() {
  const methods = useForm<SupervisorFormValues>({
    defaultValues: {
      namaDistributor: 'ABADI PUTERA',
      wilayah: [
        {
          provinsiName: 'ACEH',
          areaName: 'Area 01',
          supervisors: [
            {
              namaSupervisor: longSupervisorName,
              ktp: {
                kind: 'new',
                file: new File(['replacement'], longFileName, {
                  type: 'application/pdf',
                }),
                previous: { kind: 'existing' },
              },
            },
          ],
        },
      ],
    },
  })

  return (
    <FormProvider {...methods}>
      <SupervisorFields
        wilayahIndex={0}
        supervisorIndex={0}
        canRemove
        onRemove={vi.fn()}
      />
    </FormProvider>
  )
}

describe('SupervisorFields mobile width safety', () => {
  it('uses shrink-safe wrappers for the card, header, grid, and input', () => {
    const html = renderToString(<ExistingKtpHarness />)

    expect(html).toContain('supervisor-panel w-full min-w-0 max-w-full')
    expect(html).toContain(
      'grid w-full min-w-0 grid-cols-1 gap-5 lg:grid-cols-2',
    )
    expect(html).toContain('text-input min-w-0 max-w-full')
    expect(html).toContain(
      'mb-4 flex min-w-0 items-center justify-between gap-3',
    )
    expect(html).toContain(
      'icon-button icon-button-danger shrink-0',
    )
  })

  it('shows only replacement state for an existing KTP', () => {
    const html = renderToString(<ExistingKtpHarness />)

    expect(html).toContain('file-selected w-full min-w-0 max-w-full')
    expect(html).toContain('file-actions')
    expect(html).toContain('KTP tersimpan')
    expect(html).toContain('Ganti KTP')
    expect(html).not.toContain('Lihat File')
    expect(html).not.toContain(longFileName)
    expect(html).not.toContain('drive.google.com')
    expect(html).not.toContain('target=')
  })

  it('shows and truncates only the newly selected local filename', () => {
    const quote = String.fromCharCode(34)
    const html = renderToString(<NewKtpHarness />)

    expect(html).toContain('block max-w-full truncate')
    expect(html).toContain(`title=${quote}${longFileName}${quote}`)
    expect(html).toContain(longFileName)
    expect(html).not.toContain('Lihat File')
  })
})
