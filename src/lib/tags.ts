import type { Tx } from './types';

/** You paid for someone; they'll pay you back. Still counts as spending; the tag is for keeping track. */
export const TAG_OWED = 'A receber';
/** Someone paid or lent you money; you'll pay it back. Still counts as income; the tag is for keeping track. */
export const TAG_OWE = 'Devo';
/** Paying back or being paid back for one of the above. */
export const TAG_SETTLE = 'Acerto de contas';
export const DEBT_TAGS = [TAG_OWED, TAG_OWE, TAG_SETTLE];

export const isDebt = (t: Tx) => !!t.tags?.some((x) => DEBT_TAGS.includes(x));

/** Movements that still need a category (everything except transfers between your accounts). */
export const needsCategory = (t: Tx) => !t.categoryId && t.kind !== 'transfer';

/**
 * Who owes whom, for one person:
 * owesYou = what you paid for them (A receber) minus what they paid back to you (Acerto, money in)
 * youOwe  = what they lent you (Devo) minus what you paid back (Acerto, money out)
 */
export function debtsWith(all: Tx[], personId: number) {
  let owed = 0;
  let owe = 0;
  for (const t of all) {
    if (t.personId !== personId || !t.tags) continue;
    if (t.tags.includes(TAG_OWED)) owed += Math.abs(t.amount);
    if (t.tags.includes(TAG_OWE)) owe += Math.abs(t.amount);
    if (t.tags.includes(TAG_SETTLE)) {
      if (t.amount > 0) owed -= t.amount;
      else owe -= -t.amount;
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { owesYou: r(owed), youOwe: r(owe), net: r(owed - owe) };
}

export function allTags(all: Tx[]): string[] {
  const s = new Set<string>();
  for (const t of all) for (const x of t.tags ?? []) if (!DEBT_TAGS.includes(x)) s.add(x);
  return [...s].sort((a, b) => a.localeCompare(b, 'pt'));
}
