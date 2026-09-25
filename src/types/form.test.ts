import { describe, expect, it } from 'vitest'
import { addSupervisor, cancelNewKtpSelection, createEmptySupervisor, removeSupervisor } from './form'

describe('Supervisor card state helpers', () => {
  it('creates custom Supervisors and stops at ten', () => {
    let values = [createEmptySupervisor()]
    for (let index = 0; index < 15; index += 1) values = addSupervisor(values)
    expect(values).toHaveLength(10)
    expect(values[0]?.source).toBe('custom')
  })
  it('removes selected cards but never the final card', () => {
    const values = [createEmptySupervisor(), { ...createEmptySupervisor(), namaSupervisor: 'B' }]
    expect(removeSupervisor(values, 0).map((item) => item.namaSupervisor)).toEqual(['B'])
    expect(removeSupervisor([createEmptySupervisor()], 0)).toHaveLength(1)
  })
  it('cancels a local replacement back to private existing state', () => {
    const previous = { kind: 'existing' as const }
    const replacement = { kind: 'new' as const, file: new File(['x'], 'ktp.pdf', { type: 'application/pdf' }), previous }
    expect(cancelNewKtpSelection(replacement)).toEqual(previous)
  })
})
