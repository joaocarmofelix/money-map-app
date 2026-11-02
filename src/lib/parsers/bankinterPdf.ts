import type { ParseResult, ParsedTx } from '../types';

const NUM = String.raw`-?\d{1,3}(?:[.\s]\d{3})*,\d{2}`;
const toNum = (s: string) => parseFloat(s.replace(/[.\s]/g, '').replace(',', '.'));

/**
 * Parses the monthly Bankinter "Extracto" PDF (Contas à Ordem), given its text lines:
 *
 *   Saldo em 2026/09/01 0,00
 *   15/09 Transf imediata p/ ... c - 15/09 -15,50 484,50
 *   reconhecimento                      ← a long description carries on below
 *   Saldo em 2026/09/30 484,96
 */
export function parseBankinterPdfLines(lines: string[]): ParseResult {
  const txs: ParsedTx[] = [];
  const warnings: string[] = [];
  const closing: Record<string, number> = {};
  const lineRe = new RegExp(String.raw`^(\d\d)/(\d\d) (.+?) \d\d/\d\d (${NUM}) (${NUM})$`);
  const saldoRe = new RegExp(String.raw`^Saldo em (\d{4})/(\d\d)/(\d\d) (${NUM})$`);
  let startYear = 0;
  let startMonth = 0;
  let opening: number | null = null;
  let inMoves = false;
  let last: ParsedTx | null = null;
  let carried = 0;

  for (const raw of lines) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (!l) continue;
    const per = l.match(/de (\d{4})\/(\d\d)\/\d\d a \d{4}\/\d\d\/\d\d/);
    if (per && !startYear) {
      startYear = +per[1];
      startMonth = +per[2];
    }
    if (/^EXTRACTO DE MOVIMENTOS/i.test(l)) inMoves = true;
    if (!inMoves) continue;

    const sal = l.match(saldoRe);
    if (sal) {
      if (opening === null) opening = toNum(sal[4]);
      else closing.bkt = toNum(sal[4]);
      last = null;
      continue;
    }
    const m = l.match(lineRe);
    if (m && opening !== null) {
      const month = +m[2];
      const year = startMonth && month < startMonth ? startYear + 1 : startYear;
      last = { account: 'bkt', date: `${year}-${m[2]}-${m[1]}`, amount: toNum(m[4]), description: m[3].replace(/\s+-$/, '').trim(), balance: toNum(m[5]) };
      txs.push(last);
      carried = 0;
      continue;
    }
    // A description that didn't fit carries on in the next line or two; page headers and footers don't.
    if (last && carried < 2 && l.length < 60 && !/Extracto|Pag\.|Bankinter|Data|Valor|Saldo|Caso se|CONTA|Moeda/i.test(l)) {
      last.description = `${last.description} ${l}`;
      carried++;
      continue;
    }
    last = null;
  }

  if (!startYear) warnings.push('Não encontrei o período do extrato. Isto é um extrato do Bankinter?');
  if (opening !== null && closing.bkt !== undefined) {
    const sum = Math.round((opening + txs.reduce((a, t) => a + t.amount, 0)) * 100) / 100;
    if (Math.abs(sum - closing.bkt) > 0.005) warnings.push('O saldo final da conta Bankinter não bate certo com os movimentos lidos.');
  }
  return { bank: 'Bankinter', txs, warnings, closing };
}
