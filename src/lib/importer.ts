import type { ParsedTx, Rule, Settings, Tx } from './types';
import { classify, matchRule, potName } from './classify';
import { norm } from './text';

export function txKey(t: ParsedTx, occurrence = 0): string {
  // A running balance makes date+amount unique even for two identical coffees on the same day.
  const tail = t.balance !== undefined ? `b${t.balance.toFixed(2)}` : `${norm(t.description)}#${occurrence}`;
  return `${t.account}|${t.date}|${t.amount.toFixed(2)}|${tail}`;
}

const dayDiff = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

export interface ImportPlan {
  add: Tx[];
  skipped: number;
  /** manual tx id -> key of the imported tx that replaces it */
  merges: { manualId: number; key: string }[];
}

/**
 * Works out what an import changes, without touching the database.
 * - skips anything already imported (same key)
 * - marks own transfers and apparte moves as transfers, not spending
 * - applies your categorization rules
 * - replaces quick-added expenses with their bank counterpart (same amount, ±4 days)
 */
export function planImport(
  parsed: ParsedTx[],
  existingKeys: Set<string>,
  manual: Tx[],
  rules: Rule[],
  settings: Settings,
  knownPots: string[],
): ImportPlan {
  // Pot names come in full on the main account side; collect them first.
  const pots = new Set(knownPots);
  for (const t of parsed) {
    if (t.account !== 'mil-apparte') {
      const p = potName(t.description);
      if (p) pots.add(p);
    }
  }
  const potList = [...pots];

  const add: Tx[] = [];
  const merges: ImportPlan['merges'] = [];
  const usedManual = new Set<number>();
  const seen = new Map<string, number>();
  let skipped = 0;

  for (const t of parsed) {
    const base = `${t.account}|${t.date}|${t.amount.toFixed(2)}|${norm(t.description)}`;
    const occ = seen.get(base) ?? 0;
    seen.set(base, occ + 1);
    const key = txKey(t, occ);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const { kind, pot } = classify(t, settings.ownerNames, potList);
    const tx: Tx = { ...t, key, kind, pot, source: 'import' };
    if (kind !== 'transfer') tx.categoryId = matchRule(t.description, rules, kind)?.categoryId;

    if (kind === 'expense') {
      const candidates = manual
        .filter(
          (m) =>
            m.id !== undefined &&
            !usedManual.has(m.id) &&
            m.account === t.account &&
            Math.abs(m.amount - t.amount) < 0.005 &&
            dayDiff(m.date, t.date) <= 4,
        )
        .sort((a, b) => dayDiff(a.date, t.date) - dayDiff(b.date, t.date));
      const m = candidates[0];
      if (m) {
        usedManual.add(m.id!);
        merges.push({ manualId: m.id!, key });
        if (m.categoryId) tx.categoryId = m.categoryId;
        tx.note = m.note || m.description;
      }
    }
    add.push(tx);
  }
  return { add, skipped, merges };
}
