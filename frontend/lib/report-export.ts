'use client';

export function exportRowsCsv(filename:string, rows:Array<Record<string,unknown>>) {
  if (!rows.length) return;
  const columns=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
  const esc=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;
  const csv=[columns.map(esc).join(','),...rows.map(row=>columns.map(c=>esc(row[c])).join(','))].join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${filename}.csv`; a.click(); URL.revokeObjectURL(url);
}

export function printReport(title:string, html:string) {
  const win=window.open('','_blank','width=1100,height=800'); if(!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;color:#0f172a;padding:28px}h1{font-size:24px;margin:0 0 6px}.meta{color:#64748b;font-size:12px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}th{background:#eaf2ff}.right{text-align:right}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.card{border:1px solid #cbd5e1;border-radius:10px;padding:10px}.label{font-size:10px;color:#64748b;text-transform:uppercase}.value{font-size:18px;font-weight:700;margin-top:4px}@media print{button{display:none}}
  </style></head><body>${html}</body></html>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),250);
}

export function tableHtml(rows:Array<Record<string,unknown>>, columns?:string[]) {
  if(!rows.length) return '<p>No data available.</p>';
  const cols=columns?.length?columns:Array.from(new Set(rows.flatMap(r=>Object.keys(r)))).filter(c=>!['id','tenant_id','deleted_at','created_at','updated_at'].includes(c));
  const label=(s:string)=>s.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  return `<table><thead><tr>${cols.map(c=>`<th>${label(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${String(r[c]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
