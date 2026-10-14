import type { Kind, ParsedTx, Rule } from './types';
import { containsWord, norm } from './text';
import { DEFAULT_INCOME_IDS, INVESTMENTS } from './categories';

/** Apparte transfers look like "TRF P/ MillenniumBcp     Stocks" / "TRF DE Transferencia MillenniumBcp Fun". */
export function potName(desc: string, knownPots: string[] = []): string | null {
  const m = desc.match(/MillenniumBcp\s+(.+)$/i);
  if (!m) return null;
  const raw = m[1].replace(/\s+/g, ' ').trim();
  // The apparte side truncates names ("Future Go"); map back to a known pot.
  const hit = knownPots.find((p) => norm(p).startsWith(norm(raw)) || norm(raw).startsWith(norm(p)));
  return hit ?? raw;
}

/** True when the description names one of your own names (moving money between your accounts). */
export function isOwnTransfer(desc: string, ownerNames: string[]): boolean {
  const d = norm(desc);
  if (!/^(TRF|TRANSF|TRANSFERENCIA)/.test(d)) return false;
  return ownerNames.some((n) => n.trim().length > 3 && d.includes(norm(n)));
}

export function classify(
  t: ParsedTx,
  ownerNames: string[],
  knownPots: string[],
): { kind: Kind; pot?: string; invest?: string; cash?: boolean } {
  if (t.amount < 0 && isCashWithdrawal(t.description)) return { kind: 'transfer', cash: true };
  const inv = INVESTMENTS.find((i) => i.match.test(t.description));
  if (inv) return { kind: 'transfer', invest: inv.id };
  const pot = potName(t.description, knownPots);
  if (pot) return { kind: 'transfer', pot };
  if (t.account === 'mil-apparte') return { kind: 'transfer' };
  if (isOwnTransfer(t.description, ownerNames)) return { kind: 'transfer' };
  return { kind: t.amount < 0 ? 'expense' : 'income' };
}

/** Longest matching pattern wins, so "UBER EATS" beats "UBER". */
export function matchRule(desc: string, rules: Rule[], kind?: Kind): Rule | undefined {
  const d = norm(desc);
  let best: Rule | undefined;
  for (const r of rules) {
    // An income rule ("Outras entradas") must not tag money going out to the same person, and vice versa.
    if (kind && (r.income ?? DEFAULT_INCOME_IDS.has(r.categoryId)) !== (kind === 'income')) continue;
    if (r.pattern && containsWord(d, r.pattern) &&(!best || r.pattern.length > best.pattern.length)) best = r;
  }
  return best;
}

/** ATM withdrawals ("LEVANTAMENTO", "LEV. ATM"): the money goes to your wallet, it isn't spent yet. */
export function isCashWithdrawal(desc: string): boolean {
  const d = norm(desc);
  return /^(LEVANTAMENTO|LEV\.? ?(ATM|NUM|MB)?\b)/.test(d) || /\bLEVANTAMENTO\b/.test(d);
}
