import { describe, expect, it } from 'vitest'
import {
  addSupervisor,
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
})
