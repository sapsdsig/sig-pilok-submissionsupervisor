import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('merender searchable Distributor sebagai langkah pertama', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Logo SIG')
    expect(html).toContain('Logo PILOK')
    expect(html).toContain('PILOK - Supervisor')
    expect(html).toContain(
      'Pendataan Supervisor berdasarkan Distributor dan AP.',
    )
    expect(html).toContain('Informasi Distributor')
    expect(html).toContain('AP *')
    expect(html).toContain('combobox')
    expect(html).not.toContain('Kode Distributor')
    expect(html).not.toContain('<h2>Wilayah Operasional</h2>')
  })
})
