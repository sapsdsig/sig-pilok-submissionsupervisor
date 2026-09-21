import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cleanupUploadedKtps: vi.fn(),
  referencedFileIds: vi.fn(),
}))
vi.mock('./drive.js', () => ({
  cleanupUploadedKtps: mocks.cleanupUploadedKtps,
  isAllowedKtpMimeType: () => true,
  verifyExistingKtp: vi.fn(),
  verifyUploadedKtp: vi.fn(),
}))
vi.mock('./transactions.js', () => ({
  referencedFileIds: mocks.referencedFileIds,
}))

import { cleanupUnreferencedNewUploads } from './submissionCleanup.js'
import { extractCleanupCandidates } from './submissionValidation.js'

describe('new KTP failure cleanup safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cleanupUploadedKtps.mockResolvedValue(0)
  })

  it('extracts only new uploads, never reused existing KTP files', () => {
    const candidates = extractCleanupCandidates({
      requestToken: '20260915_123e4567-e89b-42d3-a456-426614174000',
      wilayah: [{
        supervisors: [
          { ktp: { kind: 'existing' } },
          { ktp: { kind: 'new', fileId: 'file_new_123456789' } },
        ],
      }],
    })
    expect(candidates?.fileIds).toEqual(['file_new_123456789'])
  })

  it('deletes a newly uploaded file when Sheets does not reference it', async () => {
    mocks.referencedFileIds.mockResolvedValue(new Set())
    await cleanupUnreferencedNewUploads('request-token', ['file_new_123456789'])
    expect(mocks.cleanupUploadedKtps).toHaveBeenCalledWith(
      'request-token',
      ['file_new_123456789'],
    )
  })

  it('preserves a new file when an ambiguous successful write references it', async () => {
    mocks.referencedFileIds.mockResolvedValue(new Set(['file_new_123456789']))
    await cleanupUnreferencedNewUploads('request-token', ['file_new_123456789'])
    expect(mocks.cleanupUploadedKtps).toHaveBeenCalledWith('request-token', [])
  })

  it('preserves uploads when Sheets reference lookup fails', async () => {
    mocks.referencedFileIds.mockRejectedValue(new Error('Sheets unavailable'))
    await cleanupUnreferencedNewUploads('request-token', ['file_new_123456789'])
    expect(mocks.cleanupUploadedKtps).not.toHaveBeenCalled()
  })
})
