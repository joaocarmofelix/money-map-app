import type { ParseResult, ParsedTx } from '../types';

const NUM = String.raw`\d{1,3}(?: \d{3})*\.\d{2}`;
const toNum = (s: string) => parseFloat(s.replace(/ /g, ''));

/**
 * Parses the monthly "Extrato Combinado" PDF from Millennium bcp, given its text lines.
 *
 * Every movement line ends with the running balance, so the signed amount is the
 * difference to the previous balance. That avoids having to know which column
 * (débito/crédito) a number sat in, and guarantees the sum matches the statement.
 */
export function parseMillenniumLines(lines: string[]): ParseResult {
  const txs: ParsedTx[] = [];
  const warnings: string[] = [];
  const closing: Record<string, number> = {};
  let account: string | null = null;
  let startYear = 0;
  let startMonth = 0;
  let prev: number | null = null;

  // Not anchored at the start: stray page text can precede a movement on the same line.
  // Months 1–9 are printed without a leading zero ("1.05"), October onwards as "10.05".
  const lineRe = new RegExp(String.raw`(?:^|\s)(\d{1,2})\.(\d\d) \d{1,2}\.\d\d (.+?)\s+(${NUM})\s+(${NUM})$`);
  const openRe = new RegExp(String.raw`^(SALDO INICIAL|TRANSPORTE)\s+(-?${NUM})$`);
  const closeRe = new RegExp(String.raw`^SALDO FINAL\s+(-?${NUM})$`);

  for (const raw of lines) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (!l) continue;

    const acc = l.match(/^CONTA (MILLENNIUM|APPARTE)\b/);
    if (acc) {
      account = acc[1] === 'APPARTE' ? 'mil-apparte' : 'mil';
      prev = null;
      continue;
    }
    // Any other product section (cards, deposits...) is ignored until a known one starts.
    if (/^(CONTA|CARTAO|DEPOSITO) [A-Z]/.test(l) && !/^CONTA:/.test(l)) {
      account = null;
      continue;
    }
    const per = l.match(/^EXTRATO DE (\d{4})\/(\d\d)\/\d\d A/);
    if (per) {
      startYear = +per[1];
      startMonth = +per[2];
      continue;
    }
    if (!account) continue;

    const op = l.match(openRe);
    if (op) {
      prev = toNum(op[2]);
      continue;
    }
    const cl = l.match(closeRe);
    if (cl) {
      closing[account] = toNum(cl[1]);
      if (prev !== null && Math.abs(prev - closing[account]) > 0.005) {
        warnings.push(`O saldo final da conta ${account} não bate certo com os movimentos lidos.`);
      }
      continue;
    }

    const m = l.match(lineRe);
    if (m && prev !== null) {
      const month = +m[1];
      const day = m[2];
      // Statements are one calendar month, but guard a December→January crossing.
      const year = month < startMonth ? startYear + 1 : startYear;
      const balance = toNum(m[5]);
      const amount = Math.round((balance - prev) * 100) / 100;
      prev = balance;
      txs.push({
        account,
        date: `${year}-${String(month).padStart(2, '0')}-${day}`,
        amount,
        description: m[3].trim(),
        balance,
      });
    }
  }

  if (!startYear) warnings.push('Não encontrei o período do extrato. Isto é um extrato Millennium?');
  return { bank: 'Millennium', txs, warnings, closing };
}
