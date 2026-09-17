import { describe, expect, it } from 'vitest'
import { formatWibTimestamp } from './timestamps.js'

describe('formatWibTimestamp', () => {
  it('formats a UTC instant as Asia/Jakarta time', () => {
    expect(
      formatWibTimestamp(new Date('2026-09-17T03:36:55.376Z')),
    ).toBe('2026-09-17 10:36:55')
  })

  it('handles date rollover when UTC plus seven crosses midnight', () => {
    expect(
      formatWibTimestamp(new Date('2026-09-17T18:30:05.000Z')),
    ).toBe('2026-09-18 01:30:05')
  })

  it('always returns the exact 24-hour timestamp shape', () => {
    const timestamp = formatWibTimestamp(
      new Date('2026-01-02T17:04:09.999Z'),
    )

    expect(timestamp).toBe('2026-01-03 00:04:09')
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
