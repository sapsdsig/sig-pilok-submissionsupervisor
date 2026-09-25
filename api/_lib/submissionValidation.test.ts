import { describe, expect, it, vi } from 'vitest'
import type { SubmissionRequest, UploadedKtp } from '../../src/types/api.js'
import type { PersistedSubmission } from './transactionTypes.js'
import { validateAndNormalizeSubmission, type SubmissionValidationDependencies } from './submissionValidation.js'

const uploaded: UploadedKtp = { fileId: 'file_123456789', fileName: 'KTP.pdf', mimeType: 'application/pdf', fileUrl: 'https://drive.google.com/file/x' }
const deps = (): SubmissionValidationDependencies => ({
  getDistributorAp: vi.fn(async () => ({ distributor: { namaDistributor: 'VENDOR A' }, ap: { ap: 'Supervisor AP1 SP' } })),
  getBaseline: vi.fn(async (input) => ({ vendorName: 'VENDOR A', ap: 'Supervisor AP1 SP', fullname: input.namaSupervisor, idMdxl: input.idMdxl })),
  verifyNewKtp: vi.fn(async () => uploaded), verifyExistingKtp: vi.fn(async () => uploaded),
})
const base = (): SubmissionRequest => ({
  requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000', namaDistributor: 'vendor a', ap: 'supervisor ap1 sp',
  supervisors: [{ source: 'baseline', idMdxl: '1453366', namaSupervisor: 'APRIFALDI', ktp: { kind: 'not-required' } }],
})
const existing = (): PersistedSubmission => ({
  submissionId: 'SUP-1', submissionAreaId: 'AREA-1', namaDistributor: 'VENDOR A', ap: 'Supervisor AP1 SP', createdAt: '2026-01-01 10:00:00', updatedAt: '2026-01-01 10:00:00',
  supervisors: [{ supervisorId: 'SPV-CUSTOM', idMdxl: '', namaSupervisor: 'CUSTOM', ktp: { fileId: uploaded.fileId, fileName: uploaded.fileName, fileUrl: uploaded.fileUrl } }],
})

describe('Phase 7 submission validation', () => {
  it('allows a master-validated baseline without KTP', async () => {
    const result = await validateAndNormalizeSubmission(base(), null, deps())
    expect(result.supervisors[0]).toMatchObject({ idMdxl: '1453366', ktpSource: 'not-required' })
  })
  it('does not allow fake ID MDXL to bypass KTP', async () => {
    const dependencies = deps(); vi.mocked(dependencies.getBaseline).mockRejectedValue(new Error('fake'))
    await expect(validateAndNormalizeSubmission(base(), null, dependencies)).rejects.toThrow('fake')
  })
  it('requires KTP for custom Supervisor', async () => {
    const value = base(); value.supervisors = [{ source: 'custom', namaSupervisor: 'CUSTOM', ktp: { kind: 'not-required' } }]
    await expect(validateAndNormalizeSubmission(value, null, deps())).rejects.toMatchObject({ code: 'KTP_INVALID' })
  })
  it('accepts a new custom KTP and canonicalizes Distributor/AP', async () => {
    const value = base(); value.supervisors = [{ source: 'custom', namaSupervisor: 'CUSTOM', ktp: { kind: 'new', ...uploaded } }]
    const result = await validateAndNormalizeSubmission(value, null, deps())
    expect(result.distributor.namaDistributor).toBe('VENDOR A'); expect(result.ap.ap).toBe('Supervisor AP1 SP'); expect(result.supervisors[0]?.idMdxl).toBe('')
  })
  it('allows saved custom Supervisor to reuse existing KTP', async () => {
    const value = base(); value.submissionAreaId = 'AREA-1'; value.supervisors = [{ supervisorId: 'SPV-CUSTOM', source: 'custom', namaSupervisor: 'CUSTOM EDIT', ktp: { kind: 'existing' } }]
    await expect(validateAndNormalizeSubmission(value, existing(), deps())).resolves.toMatchObject({ supervisors: [{ ktpSource: 'existing' }] })
  })
})
