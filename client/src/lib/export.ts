export type ExportFormat = 'csv' | 'json';

type Row = Record<string, unknown>;

// UTF-8 byte order mark so Excel opens the CSV with the right encoding
const UTF8_BOM = String.fromCharCode(0xfeff);

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(','));
  return lines.join('\r\n');
}

export function exportRows(rows: Row[], format: ExportFormat, baseName: string): void {
  const file =
    format === 'csv'
      ? { body: `${UTF8_BOM}${toCsv(rows)}`, type: 'text/csv;charset=utf-8', ext: 'csv' }
      : { body: JSON.stringify(rows, null, 2), type: 'application/json', ext: 'json' };

  const url = URL.createObjectURL(new Blob([file.body], { type: file.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}.${file.ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
