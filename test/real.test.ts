// Runs only when the private sample statements are present locally (never committed).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseMillenniumLines } from '../src/lib/parsers/millennium';
import { parseBankinterRows } from '../src/lib/parsers/bankinter';
import { linesFromDoc } from '../src/lib/parsers';
import { planImport } from '../src/lib/importer';
import { suggestPattern } from '../src/lib/text';

const DIR = process.env.SAMPLES ?? '';
const has = DIR && existsSync(`${DIR}/m.pdf`);

describe.skipIf(!has)('real statements', () => {
  it('parses Millennium PDF via pdf.js', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(`${DIR}/m.pdf`)) }).promise;
    const lines = await linesFromDoc(doc);
    const r = parseMillenniumLines(lines);
    console.log(r.warnings, r.closing, r.txs.length);
    expect(r.warnings).toEqual([]);
    expect(r.txs.length).toBe(52);
    const settings = { ownerNames: ['JOAO PEDRO CARMO FELIX'], potStart: {}, trackFrom: '', investStart: {} };
    const plan = planImport(r.txs, new Set(), [], [], settings, []);
    const kinds = plan.add.reduce((a, t) => ({ ...a, [t.kind]: (a[t.kind] ?? 0) + 1 }), {} as Record<string, number>);
    console.log(kinds, [...new Set(plan.add.filter(t => t.pot).map(t => `${t.account}:${t.pot}`))]);
    console.log(plan.add.filter(t => t.kind === 'expense').map(t => `${suggestPattern(t.description).padEnd(16)} <- ${t.description}`).join('\n'));
    // re-import is a no-op
    const again = planImport(r.txs, new Set(plan.add.map(t => t.key)), [], [], settings, []);
    expect(again.add.length).toBe(0);
  });
  it('parses Bankinter xls', () => {
    const wb = XLSX.read(readFileSync(`${DIR}/b.xls`), { cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }) as any[][];
    const r = parseBankinterRows(rows);
    console.log(r.txs, r.warnings, r.closing);
    expect(r.txs.length).toBe(9);
  });
});
