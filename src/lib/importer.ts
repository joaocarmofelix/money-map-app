import type { ParsedTx, Person, Rule, Settings, Tx } from './types';
import { classify, matchRule, personCategory, personFor, potName } from './classify';
import { norm } from './text';

export function txKey(t: ParsedTx, occurrence = 0): string {
  // A running balance makes date+amount unique even for two identical coffees on the same day...
  if (t.balance !== undefined) {
    const k = `${t.account}|${t.date}|${t.amount.toFixed(2)}|b${t.balance.toFixed(2)}`;
    // ...except when money goes out and back in on the same day (+100, −100, +100 lands on the same
    // balance twice). The repeat gets a counter; the first one keeps the plain key, as before.
    return occurrence > 0 ? `${k}#${occurrence}` : k;
  }
  return `${t.account}|${t.date}|${t.amount.toFixed(2)}|${norm(t.description)}#${occurrence}`;
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
  people: Person[] = [],
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
    // Count repeats of whatever the key is built from, so two lines never share a key.
    const base = t.balance !== undefined ? txKey(t) : `${t.account}|${t.date}|${t.amount.toFixed(2)}|${norm(t.description)}`;
    const occ = seen.get(base) ?? 0;
    seen.set(base, occ + 1);
    const key = txKey(t, occ);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    const { kind, pot, invest, cash } = classify(t, settings.ownerNames, potList);
    const tx: Tx = { ...t, key, kind, pot, invest, cash, source: 'import' };
    if (kind !== 'transfer') {
      tx.categoryId = matchRule(t.description, rules, kind)?.categoryId;
      const person = personFor(t.description, people);
      if (person) {
        tx.personId = person.id;
        tx.categoryId ??= personCategory(person, t.amount);
      }
    }
    add.push(tx);
  }

  // Taking money out of an apparte: the apparte side only says "TRF P/ <your name>", without the
  // apparte's name. Borrow it from the matching entry on the main account (same day, same amount).
  const usedPot = new Set<number>();
  add.forEach((t) => {
    if (t.account !== 'mil-apparte' || t.pot) return;
    const i = add.findIndex((o, j) => !usedPot.has(j) && o.account !== 'mil-apparte' && o.pot && o.date === t.date && Math.abs(o.amount + t.amount) < 0.005);
    if (i >= 0) {
      usedPot.add(i);
      t.pot = add[i].pot;
    }
  });

  const pairs = matchManual(add, manual);
  const merges: ImportPlan['merges'] = [];
  for (const [i, m] of pairs) {
    const tx = add[i];
    merges.push({ manualId: m.id!, key: tx.key });
    const { id: _id, ...orig } = m;
    tx.manualOrig = orig;
    if (m.categoryId) tx.categoryId = m.categoryId;
    tx.note = m.note || m.description;
    if (m.tags?.length) tx.tags = m.tags;
    if (m.personId) tx.personId = m.personId;
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

/**
 * Re-checks movements that are still waiting for a category with the current rules.
 * Movements imported by an older version (or before your name was set) can be transfers
 * that weren't recognised then: an apparte withdrawal, money between your own accounts.
 * Re-importing the same statement skips them as duplicates, so this fixes them in place.
 * Only touches imported movements you haven't categorised or linked to a person.
 */
export function reclassifyOpen(all: Tx[], settings: Settings, rules: Rule[], people: Person[] = []): { id: number; patch: Partial<Tx> }[] {
  const pots = new Set<string>();
  for (const t of all) {
    if (t.account === 'mil-apparte') continue;
    const p = t.pot ?? potName(t.description);
    if (p) pots.add(p);
  }
  const potList = [...pots];
  const out: { id: number; patch: Partial<Tx> }[] = [];
  const open = all.filter((t) => t.id !== undefined && t.source === 'import' && !t.categoryId && !t.personId && t.kind !== 'transfer');
  for (const t of open) {
    const c = classify(t, settings.ownerNames, potList);
    if (c.kind === 'transfer') {
      out.push({ id: t.id!, patch: { kind: 'transfer', pot: c.pot, invest: c.invest, cash: c.cash } });
      continue;
    }
    const patch: Partial<Tx> = {};
    if (c.kind !== t.kind) patch.kind = c.kind;
    const cat = matchRule(t.description, rules, c.kind)?.categoryId;
    const person = personFor(t.description, people);
    if (person) patch.personId = person.id;
    const categoryId = cat ?? (person ? personCategory(person, t.amount) : undefined);
    if (categoryId) patch.categoryId = categoryId;
    if (Object.keys(patch).length) out.push({ id: t.id!, patch });
  }
  // Apparte side of a withdrawal: borrow the apparte name from the main account entry.
  const fixed = new Map(out.map((u) => [u.id, u.patch]));
  const view = all.map((t) => (t.id !== undefined && fixed.has(t.id) ? { ...t, ...fixed.get(t.id) } : t));
  const used = new Set<number>();
  for (const t of view) {
    if (t.account !== 'mil-apparte' || t.pot || t.id === undefined) continue;
    const o = view.find((x) => x.id !== undefined && !used.has(x.id) && x.account !== 'mil-apparte' && x.pot && x.date === t.date && Math.abs(x.amount + t.amount) < 0.005);
    if (!o) continue;
    used.add(o.id!);
    const prev = fixed.get(t.id);
    if (prev) prev.pot = o.pot;
    else out.push({ id: t.id, patch: { pot: o.pot } });
  }
  return out;
}
