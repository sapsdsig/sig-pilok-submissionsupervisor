import { ApiError } from './errors.js'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new ApiError(
      500,
      'GOOGLE_CONFIG_ERROR',
      `Environment variable ${name} belum tersedia.`,
    )
  }
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

export function getGoogleOAuthConfig() {
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    refreshToken: required('GOOGLE_REFRESH_TOKEN'),
  }
}

export function getMasterSupervisorSheetConfig() {
  return {
    spreadsheetId: required('GOOGLE_MASTER_SUPERVISOR_SPREADSHEET_ID'),
    sheetName: optional(
      'GOOGLE_MASTER_SUPERVISOR_SHEET_NAME',
      'master_supervisor',
    ),
  }
}

export function getSubmissionSheetConfig() {
  return {
    spreadsheetId: required('GOOGLE_SUBMISSION_SPREADSHEET_ID'),
    submissionSheetName: optional(
      'GOOGLE_SUBMISSION_SHEET_NAME',
      'submission',
    ),
    submissionAreaSheetName: optional(
      'GOOGLE_SUBMISSION_AREA_SHEET_NAME',
      'submission_area',
    ),
    submissionSupervisorSheetName: optional(
      'GOOGLE_SUBMISSION_SUPERVISOR_SHEET_NAME',
      'submission_supervisor',
    ),
  }
}

export function getDriveKtpFolderId(): string {
  return required('GOOGLE_DRIVE_KTP_FOLDER_ID')
}
