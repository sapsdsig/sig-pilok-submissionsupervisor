import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from './SearchableSelect'

const renderSelected = (label: string, ariaLabel: string) =>
  renderToString(
    <SearchableSelect
      inputId='searchable-field'
      ariaLabel={ariaLabel}
      fieldPath='field'
      value={label}
      options={[{ value: label, label }]}
      placeholder='Cari...'
      emptyMessage='Data tidak ditemukan.'
      onChange={vi.fn()}
    />,
  )

describe('SearchableSelect selected value', () => {
  const quote = String.fromCharCode(34)

  it.each([
    ['Distributor', 'CENDRAWASIH MULIA PERKASA, PT'],
    ['Provinsi', 'ACEH'],
    ['Area', 'Area 02'],
  ])('renders the selected %s as a legible combobox value', (ariaLabel, label) => {
    const html = renderSelected(label, ariaLabel)

    expect(html).toContain(`aria-label=${quote}${ariaLabel}${quote}`)
    expect(html).toContain('searchable-select-selected')
    expect(html).toContain(`title=${quote}${label}${quote}`)
    expect(html).toContain(`>${label}</span>`)
    expect(html).toContain('▾')
    expect(html).not.toContain('placeholder=')
  })

  it('keeps a long selected label inside a truncating container', () => {
    const label =
      'DISTRIBUTOR DENGAN NAMA SANGAT PANJANG UNTUK MEMASTIKAN LAYOUT TETAP AMAN'
    const html = renderSelected(label, 'Distributor')

    expect(html).toContain('min-w-0 flex-1 truncate text-left')
    expect(html).toContain(`title=${quote}${label}${quote}`)
    expect(html).toContain('shrink-0')
  })
})
