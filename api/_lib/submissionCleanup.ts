import { cleanupUploadedKtps } from './drive.js'
import { referencedFileIds } from './transactions.js'

export async function cleanupUnreferencedNewUploads(
  requestToken: string,
  fileIds: readonly string[],
): Promise<void> {
  if (fileIds.length === 0) return
  try {
    const referenced = await referencedFileIds(fileIds)
    const unreferenced = fileIds.filter((fileId) => !referenced.has(fileId))
    await cleanupUploadedKtps(requestToken, unreferenced)
  } catch (error) {
    // If Sheets cannot confirm references, preserving files is safer than
    // deleting a file that an ambiguous successful write may now reference.
    console.error('New KTP cleanup skipped because references are ambiguous', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  }
}
