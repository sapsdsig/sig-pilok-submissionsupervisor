import 'dotenv/config'
import { extractSavedCombinations, runBaselineImport } from '../api/_lib/baselineImport.js'
import { getSubmissionSheetConfig } from '../api/_lib/env.js'
import { loadSupervisorMaster } from '../api/_lib/masterData.js'
import { SUBMISSION_AREA_HEADERS, SUBMISSION_HEADERS, SUBMISSION_SUPERVISOR_HEADERS } from '../api/_lib/sheetHeaders.js'
import { appendTablesAtomically, getSheetIdMap, readSheetTable } from '../api/_lib/sheets.js'

const apply = process.argv.includes('--apply')

async function main() {
  const masterRows = await loadSupervisorMaster()
  const config = getSubmissionSheetConfig()
  const [submissionTable, areaTable, supervisorTable] = await Promise.all([
    readSheetTable(config.spreadsheetId, config.submissionSheetName, SUBMISSION_HEADERS),
    readSheetTable(config.spreadsheetId, config.submissionAreaSheetName, SUBMISSION_AREA_HEADERS),
    readSheetTable(config.spreadsheetId, config.submissionSupervisorSheetName, SUBMISSION_SUPERVISOR_HEADERS),
  ])
  const plan = await runBaselineImport({
    masterRows, supervisorTable,
    savedCombinations: extractSavedCombinations(submissionTable, areaTable),
    apply,
    write: async (records) => {
      const ids = await getSheetIdMap(config.spreadsheetId, [config.submissionSupervisorSheetName])
      await appendTablesAtomically(config.spreadsheetId, [{
        sheetName: config.submissionSupervisorSheetName,
        sheetId: ids.get(config.submissionSupervisorSheetName)!,
        headers: supervisorTable.headers,
        records,
      }])
    },
  })
  console.log('Master rows                     ' + plan.masterRows.toLocaleString('en-US'))
  console.log('Eligible baseline rows          ' + plan.eligibleRows.toLocaleString('en-US'))
  console.log('Already present                 ' + plan.alreadyPresent.toLocaleString('en-US'))
  console.log('Skipped saved combinations      ' + plan.skippedSavedCombination.toLocaleString('en-US'))
  console.log('Will insert                     ' + plan.records.length.toLocaleString('en-US'))
  console.log(apply ? '\nAPPLY complete.' : '\nDRY RUN - no data written.')
}

main().catch((error: unknown) => {
  console.error('Baseline import failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
