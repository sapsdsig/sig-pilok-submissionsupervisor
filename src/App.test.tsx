import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('merender lookup distributor sebagai langkah pertama', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Informasi Distributor')
    expect(html).toContain('Cari Distributor')
    expect(html).not.toContain('Wilayah Operasional')
  })
})
