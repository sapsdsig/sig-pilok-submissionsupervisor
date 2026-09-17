import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ActionBar,
  FormShell,
  SectionCard,
  SectionHeader,
  StatusBanner,
} from './FormLayout'

describe('shared PILOK form layout', () => {
  const quote = String.fromCharCode(34)

  it('renders the SIG brand header, title, and subtitle', () => {
    const html = renderToString(
      <FormShell
        title='PILOK - Supervisor'
        subtitle='Form pendataan Supervisor Distributor.'
      >
        <p>Form content</p>
      </FormShell>,
    )

    expect(html).toContain(
      `src=${quote}/branding/sig-logo-black.png${quote}`,
    )
    expect(html).toContain(`alt=${quote}Logo SIG${quote}`)
    expect(html).toContain('PILOK - Supervisor')
    expect(html).toContain('Form pendataan Supervisor Distributor.')
    expect(html).toContain('Form content')
  })

  it('renders reusable section, status, and action patterns', () => {
    const html = renderToString(
      <>
        <SectionCard>
          <SectionHeader
            step={1}
            title='Informasi Distributor'
            description='Pilih Distributor.'
          />
        </SectionCard>
        <ActionBar
          feedback={
            <StatusBanner variant='success' title='Berhasil'>
              Data tersimpan.
            </StatusBanner>
          }
        >
          <button type='button'>Simpan Data</button>
        </ActionBar>
      </>,
    )

    expect(html).toContain('form-section')
    expect(html).toContain('section-heading')
    expect(html).toContain('status-banner-success')
    expect(html).toContain('action-bar')
    expect(html).toContain('Simpan Data')
  })
})
