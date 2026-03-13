import * as XLSX from 'xlsx'

/**
 * Sanitize a string for use as xlsx sheet name or filename.
 * Removes characters forbidden in Excel sheet names: \ / ? * [ ]
 * and replaces them with underscores.
 */
function sanitize(str) {
  return str.replace(/[\\/?*[\]]/g, '_')
}

/**
 * Download a workbook as .xlsx file in the browser.
 */
export function downloadXlsx(wb, filename) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitize(filename)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Create a workbook with a single sheet and trigger download.
 */
export function exportSheet(rows, sheetName, filename) {
  if (!rows || rows.length === 0) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sanitize(sheetName).slice(0, 31))
  downloadXlsx(wb, filename)
}
