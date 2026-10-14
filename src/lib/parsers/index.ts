import type { ParseResult } from '../types';
import { parseMillenniumLines } from './millennium';
import { parseBankinterRows } from './bankinter';

/** Rebuilds visual text lines from a PDF using pdf.js item positions. */
export async function pdfToLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  if (import.meta.env.MODE === 'artifact') {
    // Single-file build: run the worker from a blob instead of a separate file.
    const src = (await import('pdfjs-dist/build/pdf.worker.min.mjs?raw')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  } else {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const doc = await pdfjs.getDocument({ data }).promise;
  return linesFromDoc(doc);
}

interface TextItemLike {
  str: string;
  transform: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function linesFromDoc(doc: any): Promise<string[]> {
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as TextItemLike[]) {
      if (!('str' in it) || !it.str.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      out.push(r.items.map((i) => i.s.trim()).join(' '));
    }
  }
  return out;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf')) {
    const lines = await pdfToLines(buf);
    const joined = lines.join('\n');
    if (/MILLENNIUM|MILLENNIUMBCP/i.test(joined)) return parseMillenniumLines(lines);
    return { bank: '?', txs: [], warnings: ['Este PDF não parece ser um extrato Millennium.'], closing: {} };
  }
  if (/\.(xls|xlsx|csv)$/.test(name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }) as (
      | string
      | number
      | Date
      | null
    )[][];
    const flat = rows.flat().map((c) => String(c ?? '')).join(' ');
    if (/bankinter/i.test(flat)) return parseBankinterRows(rows);
    return { bank: '?', txs: [], warnings: ['Não reconheci este ficheiro. Por agora leio o Excel do Bankinter.'], closing: {} };
  }
  return { bank: '?', txs: [], warnings: ['Formato não suportado. Usa o PDF do Millennium ou o Excel do Bankinter.'], closing: {} };
}
