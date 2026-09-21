import { describe, expect, it } from 'vitest'
import {
  addSupervisor,
  cancelNewKtpSelection,
  createEmptyWilayah,
  removeSupervisor,
} from './form'

describe('Supervisor card state helpers', () => {
  it('starts a new Wilayah with exactly one Supervisor', () => {
    expect(createEmptyWilayah().supervisors).toHaveLength(1)
  })

  it('adds Supervisors and stops at ten', () => {
    let supervisors = createEmptyWilayah().supervisors
    for (let index = 0; index < 15; index += 1) {
      supervisors = addSupervisor(supervisors)
    }
    expect(supervisors).toHaveLength(10)
  })

  it('removes a selected Supervisor and naturally reindexes the array', () => {
    const supervisors = [
      { namaSupervisor: 'A', ktp: null },
      { namaSupervisor: 'B', ktp: null },
      { namaSupervisor: 'C', ktp: null },
    ]
    expect(removeSupervisor(supervisors, 1).map((item) => item.namaSupervisor))
      .toEqual(['A', 'C'])
  })

  it('never removes the final Supervisor', () => {
    const supervisors = createEmptyWilayah().supervisors
    expect(removeSupervisor(supervisors, 0)).toHaveLength(1)
  })

  it('cancels a local replacement back to the private existing-KTP state', () => {
    const previous = { kind: 'existing' as const }
    const replacement = {
      kind: 'new' as const,
      file: new File(['replacement'], 'ktp-baru.pdf', {
        type: 'application/pdf',
      }),
      previous,
    }

    expect(cancelNewKtpSelection(replacement)).toEqual(previous)
    expect(cancelNewKtpSelection(replacement)).not.toHaveProperty('fileId')
    expect(cancelNewKtpSelection(replacement)).not.toHaveProperty('fileUrl')
  })
})
