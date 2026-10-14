import type { ParsedTx, Rule, Settings, Tx } from './types';
import { classify, matchRule, potName } from './classify';
import { norm } from './text';

export function txKey(t: ParsedTx, occurrence = 0): string {
  // A running balance makes date+amount unique even for two identical coffees on the same day.
  const tail = t.balance !== undefined ? `b${t.balance.toFixed(2)}` : `${norm(t.description)}#${occurrence}`;
  return `${t.account}|${t.date}|${t.amount.toFixed(2)}|${tail}`;
}

const dayDiff = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

export interface Reconciliation {
  account: string;
  from: string;
  to: string;
  /** Spending you logged by hand for this account in the statement period (positive euros) */
  manualCount: number;
  manualSum: number;
  /** New spending in the statement (positive euros) */
  bankCount: number;
  bankSum: number;
  /** Pairs found between the two */
  matched: number;
  /** Bank movements you hadn't logged */
  missing: { count: number; sum: number };
  /** Your entries with no bank movement: probably a different amount, account or a duplicate */
  leftover: Tx[];
}

export interface ImportPlan {
  add: Tx[];
  skipped: number;
  /** Movements before the tracking start date, left out */
  tooOld: number;
  /** manual tx id -> key of the imported tx that replaces it */
  merges: { manualId: number; key: string }[];
  recon: Reconciliation[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Works out what an import changes, without touching the database.
 * - skips anything already imported (same key)
 * - marks own transfers, apparte moves, investments and cash withdrawals as transfers, not spending
 * - applies your categorization rules
 * - pairs the bank movements with what you logged by hand (see matchManual)
 * - reports, per account, what you logged against what the bank shows
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
  const seen = new Map<string, number>();
  let skipped = 0;
  let tooOld = 0;

  for (const t of parsed) {
    if (settings.trackFrom && t.date < settings.trackFrom) {
      tooOld++;
      continue;
    }
    const base = `${t.account}|${t.date}|${t.amount.toFixed(2)}|${norm(t.description)}`;
    const occ = seen.get(base) ?? 0;
    seen.set(base, occ + 1);
    const key = txKey(t, occ);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const { kind, pot, invest, cash } = classify(t, settings.ownerNames, potList);
    const tx: Tx = { ...t, key, kind, pot, invest, cash, source: 'import' };
    if (kind !== 'transfer') tx.categoryId = matchRule(t.description, rules, kind)?.categoryId;
    add.push(tx);
  }

  const pairs = matchManual(add, manual);
  const merges: ImportPlan['merges'] = [];
  for (const [i, m] of pairs) {
    const tx = add[i];
    merges.push({ manualId: m.id!, key: tx.key });
    if (m.categoryId) tx.categoryId = m.categoryId;
    tx.note = m.note || m.description;
  }

  // Per-account comparison over the period each statement covers.
  const recon: Reconciliation[] = [];
  const accounts = [...new Set(parsed.map((t) => t.account))].filter((a) => a !== 'mil-apparte');
  const matchedManual = new Set(pairs.map(([, m]) => m.id));
  const matchedImport = new Set(pairs.map(([i]) => i));
  for (const account of accounts) {
    const dates = parsed.filter((t) => t.account === account).map((t) => t.date).sort();
    const from = dates[0];
    const to = dates[dates.length - 1];
    const inPeriod = (d: string) => d >= from && d <= to;
    // Manual entries are counted against the account they were finally paired with.
    // Compared on spending only: that's what you log during the month.
    const mine = manual.filter((m) => m.account === account && m.kind === 'expense' && inPeriod(m.date));
    const pairedHere = pairs.filter(([i]) => add[i].account === account && add[i].kind === 'expense').map(([, m]) => m);
    const logged = [...new Map([...mine, ...pairedHere].map((m) => [m.id, m])).values()];
    const bank = add.map((t, i) => ({ t, i })).filter(({ t }) => t.account === account && t.kind === 'expense');
    const missing = bank.filter(({ i }) => !matchedImport.has(i));
    recon.push({
      account,
      from,
      to,
      manualCount: logged.length,
      manualSum: r2(-logged.reduce((a, m) => a + m.amount, 0)),
      bankCount: bank.length,
      bankSum: r2(-bank.reduce((a, { t }) => a + t.amount, 0)),
      matched: pairedHere.length,
      missing: { count: missing.length, sum: r2(-missing.reduce((a, { t }) => a + t.amount, 0)) },
      leftover: mine.filter((m) => !matchedManual.has(m.id) && !m.confirmed),
    });
  }
  return { add, skipped, merges, tooOld, recon };
}

/**
 * Pairs bank movements with what you logged by hand, one to one.
 * A pair needs the same direction and the same amount to the cent, at most 4 days apart.
 * All possible pairs are ranked (closest date first; the account you picked beats another account)
 * and taken best-first, so repeated identical spends — a tournament every Wednesday and Saturday —
 * each land on their own day instead of the first one swallowing the wrong entry.
 */
export function matchManual(imported: Tx[], manual: Tx[]): [number, Tx][] {
  const cands: { i: number; m: Tx; cost: number }[] = [];
  imported.forEach((t, i) => {
    if (t.kind === 'transfer') return;
    for (const m of manual) {
      if (m.id === undefined || m.account === 'cash' || m.kind !== t.kind) continue;
      if (Math.abs(m.amount - t.amount) >= 0.005) continue;
      const dd = dayDiff(m.date, t.date);
      if (dd > 4) continue;
      cands.push({ i, m, cost: dd + (m.account === t.account ? 0 : 10) });
    }
  });
  cands.sort((a, b) => a.cost - b.cost || a.i - b.i);
  const usedI = new Set<number>();
  const usedM = new Set<number>();
  const out: [number, Tx][] = [];
  for (const c of cands) {
    if (usedI.has(c.i) || usedM.has(c.m.id!)) continue;
    usedI.add(c.i);
    usedM.add(c.m.id!);
    out.push([c.i, c.m]);
  }
  return out;
}
