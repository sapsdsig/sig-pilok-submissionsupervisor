import { describe, expect, it } from 'vitest'
import type { SupervisorFormValues } from '../types/form'
import { createSupervisorFormSchema } from './supervisorFormSchema'

const schema = createSupervisorFormSchema({
  isKnownDistributor: (value) => value.toUpperCase() === 'VENDOR A',
  isKnownAp: (vendor, ap) => vendor.toUpperCase() === 'VENDOR A' && ap.toUpperCase() === 'SUPERVISOR AP1 SP',
})
const file = () => new File(['sample'], 'ktp.pdf', { type: 'application/pdf' })
const valid = (): SupervisorFormValues => ({
  namaDistributor: 'VENDOR A', ap: 'Supervisor AP1 SP',
  supervisors: [{ source: 'custom', namaSupervisor: 'Budi', ktp: { kind: 'new', file: file() } }],
})

describe('Phase 7 frontend form schema', () => {
  it('accepts canonical AP and custom Supervisor with KTP', () => expect(schema.safeParse(valid()).success).toBe(true))
  it('accepts baseline without KTP upload', () => {
    const values = valid(); values.supervisors = [{ source: 'baseline', idMdxl: '1453366', namaSupervisor: 'APRIFALDI', ktp: { kind: 'not-required' } }]
    expect(schema.safeParse(values).success).toBe(true)
  })
  it('rejects arbitrary AP and custom Supervisor without KTP', () => {
    const arbitraryAp = valid(); arbitraryAp.ap = 'BUAT SENDIRI'
    const apResult = schema.safeParse(arbitraryAp)
    expect(apResult.success).toBe(false)
    if (!apResult.success) expect(apResult.error.issues.map((item) => item.message)).toContain('AP harus dipilih dari master Distributor.')
    const missingKtp = valid(); missingKtp.supervisors[0]!.ktp = null
    const ktpResult = schema.safeParse(missingKtp)
    expect(ktpResult.success).toBe(false)
    if (!ktpResult.success) expect(ktpResult.error.issues.map((item) => item.message)).toContain('KTP Supervisor wajib dipilih.')
  })
  it('requires at least one Supervisor', () => {
    const values = valid(); values.supervisors = []
    expect(schema.safeParse(values).success).toBe(false)
  })
})
