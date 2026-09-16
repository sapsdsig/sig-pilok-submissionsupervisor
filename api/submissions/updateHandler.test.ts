import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'

const mocks = vi.hoisted(() => ({
  cleanupPersistedKtps: vi.fn(),
  cleanupUnreferencedNewUploads: vi.fn(),
  extractCleanupCandidates: vi.fn(),
  validateAndNormalizeSubmission: vi.fn(),
  getStoredSubmissionById: vi.fn(),
  updateSubmission: vi.fn(),
}))
vi.mock('../_lib/drive.js', () => ({
  cleanupPersistedKtps: mocks.cleanupPersistedKtps,
}))
vi.mock('../_lib/submissionCleanup.js', () => ({
  cleanupUnreferencedNewUploads: mocks.cleanupUnreferencedNewUploads,
}))
vi.mock('../_lib/submissionValidation.js', () => ({
  extractCleanupCandidates: mocks.extractCleanupCandidates,
  validateAndNormalizeSubmission: mocks.validateAndNormalizeSubmission,
}))
vi.mock('../_lib/transactions.js', () => ({
  getStoredSubmissionById: mocks.getStoredSubmissionById,
  updateSubmission: mocks.updateSubmission,
}))

import handler from './[submissionId].js'

const request = {
  method: 'PUT',
  query: { submissionId: 'SUP-EXISTING' },
  body: { requestToken: 'request-token' },
  headers: {},
} as unknown as ApiRequest

function response() {
  const state = { status: 0, body: undefined as unknown }
  const result = {
    setHeader: vi.fn(),
    status: vi.fn((status: number) => {
      state.status = status
      return result
    }),
    json: vi.fn((body: unknown) => {
      state.body = body
      return result
    }),
  } as unknown as ApiResponse
  return { result, state }
}

describe('KTP edit cleanup ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStoredSubmissionById.mockResolvedValue({ submissionId: 'SUP-EXISTING' })
    mocks.validateAndNormalizeSubmission.mockResolvedValue({ validated: true })
    mocks.extractCleanupCandidates.mockReturnValue({
      requestToken: 'request-token',
      fileIds: ['file_new_123456789'],
    })
    mocks.cleanupPersistedKtps.mockResolvedValue(1)
    mocks.cleanupUnreferencedNewUploads.mockResolvedValue(undefined)
  })

  it('does not delete an old KTP when Sheets update fails', async () => {
    mocks.updateSubmission.mockRejectedValue(new Error('Sheets failed'))
    await handler(request, response().result)
    expect(mocks.cleanupPersistedKtps).not.toHaveBeenCalled()
    expect(mocks.cleanupUnreferencedNewUploads).toHaveBeenCalledWith(
      'request-token',
      ['file_new_123456789'],
    )
  })

  it('deletes old KTP candidates only after Sheets update succeeds', async () => {
    mocks.updateSubmission.mockResolvedValue({
      submission: {
        submissionId: 'SUP-EXISTING',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-16T00:00:00.000Z',
        mode: 'edit',
      },
      oldFileIdsToCleanup: ['file_old_123456789'],
    })
    await handler(request, response().result)
    expect(mocks.cleanupPersistedKtps).toHaveBeenCalledWith([
      'file_old_123456789',
    ])
    expect(mocks.updateSubmission.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cleanupPersistedKtps.mock.invocationCallOrder[0]!,
    )
    expect(mocks.cleanupUnreferencedNewUploads).not.toHaveBeenCalled()
  })
})
