import 'dotenv/config'
import { getDriveKtpFolderId, getMasterSupervisorSheetConfig, getSubmissionSheetConfig } from '../api/_lib/env.js'
import { verifyDriveFolder } from '../api/_lib/drive.js'
import { getGoogleAccessToken } from '../api/_lib/googleAuth.js'
import { MASTER_SUPERVISOR_HEADERS, SUBMISSION_AREA_HEADERS, SUBMISSION_HEADERS, SUBMISSION_SUPERVISOR_HEADERS } from '../api/_lib/sheetHeaders.js'
import { getSheetIdMap, verifySheetAccess } from '../api/_lib/sheets.js'

let failures = 0
async function check(label: string, run: () => Promise<unknown>) {
  try { await run(); console.log(`  ${label.padEnd(34)} PASS`) }
  catch (error) { failures += 1; console.error(`  ${label.padEnd(34)} FAIL  ${error instanceof Error ? error.message : 'Unknown error'}`) }
}
async function verify() {
  const master = getMasterSupervisorSheetConfig()
  const submissions = getSubmissionSheetConfig()
  await check('Google OAuth', getGoogleAccessToken)
  console.log('\nMaster Supervisor Spreadsheet')
  await check('spreadsheet and worksheet', () => getSheetIdMap(master.spreadsheetId, [master.sheetName]))
  await check('required headers', () => verifySheetAccess(master.spreadsheetId, master.sheetName, MASTER_SUPERVISOR_HEADERS))
  console.log('\nSubmission Spreadsheet')
  await check('spreadsheet and worksheets', () => getSheetIdMap(submissions.spreadsheetId, [submissions.submissionSheetName, submissions.submissionAreaSheetName, submissions.submissionSupervisorSheetName]))
  await check(`${submissions.submissionSheetName} headers`, () => verifySheetAccess(submissions.spreadsheetId, submissions.submissionSheetName, SUBMISSION_HEADERS))
  await check(`${submissions.submissionAreaSheetName} headers`, () => verifySheetAccess(submissions.spreadsheetId, submissions.submissionAreaSheetName, SUBMISSION_AREA_HEADERS))
  await check(`${submissions.submissionSupervisorSheetName} headers`, () => verifySheetAccess(submissions.spreadsheetId, submissions.submissionSupervisorSheetName, SUBMISSION_SUPERVISOR_HEADERS))
  console.log('\nKTP Drive Folder')
  await check('folder access and upload capability', () => verifyDriveFolder(getDriveKtpFolderId()))
  if (failures) throw new Error(`${failures} Google configuration check(s) failed.`)
  console.log('\nAll Google checks passed. No files or rows were created.')
}
verify().catch((error: unknown) => { console.error('\nGoogle verification failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1 })
