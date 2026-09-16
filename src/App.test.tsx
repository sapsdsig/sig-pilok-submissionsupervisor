import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('merender searchable Distributor sebagai langkah pertama', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Informasi Distributor')
    expect(html).toContain('combobox')
    expect(html).not.toContain('Kode Distributor')
    expect(html).not.toContain('Wilayah Operasional')
  })
})
