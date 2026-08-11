'use client';

export type ExportRow = Record<string, unknown>;

const prettify = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g, x => x.toUpperCase());
const printable = (value:unknown) => value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export async function exportRowsToExcel(filename:string, rows:ExportRow[]) {
  if (!rows.length) throw new Error('No data to export.');
  const XLSX = await import('xlsx');
  const normalized = rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [prettify(key), printable(value)])));
  const sheet = XLSX.utils.json_to_sheet(normalized);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Report');
  XLSX.writeFile(book, `${filename}.xlsx`, { compression:true });
}

export async function exportRowsToPdf(title:string, filename:string, rows:ExportRow[], summary?:Record<string,unknown>) {
  if (!rows.length && !summary) throw new Error('No data to export.');
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
  doc.setFontSize(18); doc.text(title, 40, 40);
  doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, 58);
  let y = 74;
  if (summary && Object.keys(summary).length) {
    const text = Object.entries(summary).map(([k,v]) => `${prettify(k)}: ${printable(v)}`).join('   |   ');
    const lines = doc.splitTextToSize(text, 760);
    doc.text(lines, 40, y); y += lines.length * 12 + 10;
  }
  if (rows.length) {
    const columns = Object.keys(rows[0]);
    autoTable(doc, {
      startY:y,
      head:[columns.map(prettify)],
      body:rows.map(row => columns.map(key => printable(row[key]))),
      styles:{ fontSize:7, cellPadding:3, overflow:'linebreak' },
      headStyles:{ fillColor:[15,45,97] },
      margin:{ left:30, right:30 },
    });
  }
  doc.save(`${filename}.pdf`);
}
