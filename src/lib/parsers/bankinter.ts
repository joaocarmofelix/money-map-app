import type { ParseResult, ParsedTx } from '../types';
import { norm } from '../text';

type Cell = string | number | Date | null | undefined;

function toDate(c: Cell): string | null {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === 'number') {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(c ?? '').trim();
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})-(\d\d)-(\d\d)/);
  return iso ? iso[0] : null;
}

function toNum(c: Cell): number | null {
  if (typeof c === 'number') return c;
  const s = String(c ?? '').trim();
  if (!s || s === '-') return null;
  // Accept "1.234,56" and "1234.56"
  const cleaned = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(cleaned.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Parses the Bankinter "Movimentos" Excel export, given the sheet as rows. */
export function parseBankinterRows(rows: Cell[][]): ParseResult {
  const warnings: string[] = [];
  const txs: ParsedTx[] = [];
  const header = rows.findIndex((r) => r.some((c) => norm(String(c ?? '')) === 'DATA MOVIMENTO'));
  if (header < 0) {
    return { bank: 'Bankinter', txs, warnings: ['Não encontrei a tabela de movimentos neste ficheiro.'], closing: {} };
  }
  const cols = rows[header].map((c) => norm(String(c ?? '')));
  const ci = (name: string) => cols.indexOf(name);
  const iDate = ci('DATA MOVIMENTO');
  const iDesc = ci('DESCRICAO');
  const iAmt = ci('MONTANTE');
  const iBal = ci('SALDO');

  for (const r of rows.slice(header + 1)) {
    const date = toDate(r[iDate]);
    const amount = toNum(r[iAmt]);
    if (!date || amount === null) continue;
    txs.push({
      account: 'bkt',
      date,
      amount: Math.round(amount * 100) / 100,
      description: String(r[iDesc] ?? '').replace(/\s+/g, ' ').trim(),
      balance: toNum(r[iBal]) ?? undefined,
    });
  }

  const title = rows.flat().map((c) => String(c ?? '')).find((s) => /ltimos \d+ Movimentos/i.test(s));
  const cap = title?.match(/(\d+)/)?.[1];
  if (cap && txs.length >= +cap) {
    warnings.push(
      `O ficheiro só traz os últimos ${cap} movimentos. Podem faltar movimentos mais antigos: filtra por datas no site do Bankinter antes de exportar.`,
    );
  }
  // Newest first in the file; closing balance is the first row's balance.
  const closing: Record<string, number> = {};
  if (txs[0]?.balance !== undefined) closing.bkt = txs[0].balance;
  // Store oldest first, like the Millennium statement.
  return { bank: 'Bankinter', txs: txs.reverse(), warnings, closing };
}
