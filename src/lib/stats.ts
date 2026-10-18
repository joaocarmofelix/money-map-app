import type { Goal, Settings, Tx } from './types';
import { INVESTMENTS, investName, type CatIndex } from './categories';
import { shiftMonth } from './text';
import { needsCategory } from './tags';

export interface MonthStats {
  spent: number;
  income: number;
  toPots: number;
  toInvest: number;
  /** Spending per top-level category ('_none' = uncategorized) */
  byRoot: { id: string; total: number; count: number }[];
  /** Spending per category id, including what its subcategories spent */
  byCat: Map<string, number>;
  uncategorized: number;
  /** One-off spending (e.g. house purchase), kept out of spent/byRoot/byCat */
  extra: number;
  extraByRoot: { id: string; total: number }[];
}

export function monthStats(all: Tx[], ym: string, cx: CatIndex): MonthStats {
  const txs = all.filter((t) => monthOf(t) === ym);
  const roots = new Map<string, { total: number; count: number }>();
  const byCat = new Map<string, number>();
  let spent = 0;
  let income = 0;
  let toPots = 0;
  let toInvest = 0;
  let uncategorized = 0;
  let extra = 0;
  const extraRoots = new Map<string, number>();
  for (const t of txs) {
    if (t.kind === 'transfer') {
      if (t.account === 'mil-apparte') toPots += t.amount;
      if (t.invest) toInvest += -t.amount;
      continue;
    }
    if (needsCategory(t)) uncategorized++;
    if (t.kind === 'income') {
      income += t.amount;
      continue;
    }
    const v = -t.amount;
    if (cx.isExtra(t.categoryId)) {
      extra += v;
      const r = cx.root(t.categoryId)!.id;
      extraRoots.set(r, (extraRoots.get(r) ?? 0) + v);
      continue;
    }
    spent += v;
    const root = cx.root(t.categoryId)?.id ?? '_none';
    const e = roots.get(root) ?? { total: 0, count: 0 };
    e.total += v;
    e.count++;
    roots.set(root, e);
    // Credit the category and every ancestor.
    let cur = t.categoryId ? cx.byId.get(t.categoryId) : undefined;
    while (cur) {
      byCat.set(cur.id, (byCat.get(cur.id) ?? 0) + v);
      cur = cur.parentId ? cx.byId.get(cur.parentId) : undefined;
    }
  }
  return {
    spent,
    income,
    toPots,
    toInvest,
    byRoot: [...roots.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total),
    byCat,
    uncategorized,
    extra,
    extraByRoot: [...extraRoots.entries()].map(([id, total]) => ({ id, total })),
  };
}

export function history(all: Tx[], endYm: string, n: number, cx: CatIndex) {
  const out: { ym: string; spent: number; saved: number; income: number; hasData: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = shiftMonth(endYm, -i);
    const s = monthStats(all, ym, cx);
    out.push({ ym, spent: s.spent, saved: s.toPots + s.toInvest, income: s.income, hasData: all.some((t) => monthOf(t) === ym) });
  }
  return out;
}

export type BudgetState = 'ok' | 'warn' | 'over';

/**
 * How a category is doing against its monthly limit.
 * In the current month we also project the month-end total from the pace so far.
 */
export function budgetStatus(spent: number, budget: number, ym: string, todayIso: string) {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const current = todayIso.startsWith(ym);
  const elapsed = current ? Number(todayIso.slice(8, 10)) / days : 1;
  const pct = budget > 0 ? spent / budget : 0;
  const projected = current && elapsed > 0 ? spent / elapsed : spent;
  let state: BudgetState = 'ok';
  if (spent > budget) state = 'over';
  // Near the limit, or clearly ahead of the month's pace. The margin keeps bills paid early in the
  // month (rent, internet, subscriptions) from raising a false alarm.
  else if (pct >= 0.85 || (current && pct >= 0.5 && pct > elapsed + 0.3)) state = 'warn';
  return { pct, state, projected, elapsed, left: budget - spent };
}

/** Pot balances from the apparte account's own movements, plus any starting balance you set. */
export function potBalances(all: Tx[], settings: Settings, upTo?: string): { pot: string; balance: number }[] {
  const m = new Map<string, number>(Object.entries(settings.potStart));
  for (const t of all) {
    if (t.account !== 'mil-apparte' || !t.pot) continue;
    if (upTo && t.date > upTo) continue;
    m.set(t.pot, (m.get(t.pot) ?? 0) + t.amount);
  }
  return [...m.entries()].map(([pot, balance]) => ({ pot, balance })).sort((a, b) => b.balance - a.balance);
}

/** Latest known balance per account, from the statements. */
export function accountBalances(all: Tx[]): Record<string, { balance: number; date: string }> {
  const out: Record<string, { balance: number; date: string }> = {};
  const sorted = [...all]
    .filter((t) => t.balance !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));
  for (const t of sorted) out[t.account] = { balance: t.balance!, date: t.date };
  return out;
}

/** Money put into each investment account: what you had before tracking + transfers since. */
export function investBalances(all: Tx[], settings: Settings, upTo?: string): { id: string; invested: number }[] {
  return INVESTMENTS.map((i) => {
    let v = settings.investStart[i.id] ?? 0;
    for (const t of all) if (t.invest === i.id && (!upTo || t.date <= upTo)) v += -t.amount;
    return { id: i.id, invested: v };
  }).filter((x) => x.invested !== 0 || settings.investStart[x.id] !== undefined);
}

/** Apparte money not assigned to any named pot (usually a missing starting balance). */
export function unassignedPotMoney(all: Tx[], settings: Settings): number | null {
  const last = [...all]
    .filter((t) => t.account === 'mil-apparte' && t.balance !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    .pop();
  if (!last) return null;
  const assigned = potBalances(all, settings, last.date).reduce((s, p) => s + p.balance, 0);
  return Math.round((last.balance! - assigned) * 100) / 100;
}

export interface AccountView {
  key: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  /** Short line under the balance */
  sub: string;
  group: 'bank' | 'pot' | 'invest';
  /** Statement balance minus the balance worked out from the movements (0 when they agree) */
  mismatch?: number;
}

const BANKS: Record<string, { name: string; color: string }> = {
  mil: { name: 'Millennium', color: 'var(--s8)' },
  bkt: { name: 'Bankinter', color: 'var(--s2)' },
};
const POT_COLORS = ['var(--s3)', 'var(--s7)', 'var(--s5)', 'var(--s4)', 'var(--s6)'];
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

/** Every account the app knows about: bank accounts, each apparte on its own, and investments. */
export function accountList(all: Tx[], settings: Settings): AccountView[] {
  const out: AccountView[] = [];
  for (const id of ['mil', 'bkt']) {
    const v = computedBalance(all, id);
    if (!v) continue;
    const parts = [v.mismatch ? `Difere ${v.mismatch > 0 ? '+' : ''}${v.mismatch.toFixed(2).replace('.', ',')} € do extrato` : `Confere com o extrato de ${dm(v.statementDate)}`];
    if (v.manualAfter) parts.push(`+ ${v.manualAfter} apontados`);
    out.push({ key: id, name: BANKS[id].name, icon: 'landmark', color: BANKS[id].color, balance: v.balance, sub: parts.join(' · '), group: 'bank', mismatch: v.mismatch || undefined });
  }
  potBalances(all, settings).forEach((p, i) =>
    out.push({ key: `pot:${p.pot}`, name: p.pot, icon: 'piggy', color: POT_COLORS[i % POT_COLORS.length], balance: p.balance, sub: 'Apparte Millennium', group: 'pot' }),
  );
  const un = unassignedPotMoney(all, settings);
  if (un !== null && Math.abs(un) > 0.005) {
    out.push({ key: 'pot:_unassigned', name: 'Appartes por atribuir', icon: 'piggy', color: 'var(--ink-3)', balance: un, sub: 'Indica o saldo inicial de cada apparte', group: 'pot' });
  }
  // Cash: what you withdrew at ATMs, minus what you logged as paid in cash.
  const cashTx = all.filter((t) => t.cash || t.account === 'cash');
  if (cashTx.length) {
    const balance = cashTx.reduce((a, t) => a + (t.account === 'cash' ? t.amount : -t.amount), 0);
    out.push({ key: 'cash', name: 'Dinheiro', icon: 'banknote', color: 'var(--s6)', balance: Math.round(balance * 100) / 100, sub: 'Na carteira', group: 'bank' });
  }
  for (const i of investBalances(all, settings)) {
    out.push({ key: `inv:${i.id}`, name: investName(i.id), icon: 'trending', color: 'var(--s1)', balance: i.invested, sub: 'Investido', group: 'invest' });
  }
  return out;
}

export const netWorth = (accounts: AccountView[]) => accounts.reduce((a, x) => a + x.balance, 0);

export interface GoalProgress {
  current: number;
  pct: number;
  left: number;
  /** Per-month amount still needed to hit a dated balance goal */
  perMonth?: number;
  /** Consecutive finished months a monthly goal was met */
  streak?: number;
  done: boolean;
}

export function goalProgress(g: Goal, all: Tx[], settings: Settings, cx: CatIndex, todayIso: string): GoalProgress {
  if (g.type === 'monthly') {
    const ym = todayIso.slice(0, 7);
    const s = monthStats(all, ym, cx);
    const current = s.toPots + s.toInvest;
    let streak = 0;
    for (let i = 1; i <= 24; i++) {
      const m = shiftMonth(ym, -i);
      if (!all.some((t) => monthOf(t) === m)) break;
      const ms = monthStats(all, m, cx);
      if (ms.toPots + ms.toInvest >= g.target) streak++;
      else break;
    }
    return { current, pct: g.target ? current / g.target : 0, left: g.target - current, streak, done: current >= g.target };
  }
  const accts = accountList(all, settings);
  const current = g.account === 'networth' || !g.account ? netWorth(accts) : (accts.find((a) => a.key === g.account)?.balance ?? 0);
  const left = g.target - current;
  let perMonth: number | undefined;
  if (g.deadline && left > 0) {
    const months = Math.max(1, (Number(g.deadline.slice(0, 4)) - Number(todayIso.slice(0, 4))) * 12 + Number(g.deadline.slice(5, 7)) - Number(todayIso.slice(5, 7)));
    perMonth = left / months;
  }
  return { current, pct: g.target ? current / g.target : 0, left, perMonth, done: current >= g.target };
}

/**
 * Transfers to/from yourself where the other side isn't in any imported statement
 * (same amount, opposite sign, another account, within 5 days). Usually money that went to
 * an account the app doesn't track, or a statement that hasn't been imported yet.
 */
export function unpairedOwnTransfers(all: Tx[]): Tx[] {
  const own = all.filter((t) => t.kind === 'transfer' && !t.pot && !t.invest && !t.cash && t.account !== 'mil-apparte');
  const used = new Set<number>();
  const out: Tx[] = [];
  const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
  for (const t of own) {
    if (used.has(t.id!)) continue;
    const m = own.find((o) => o.id !== t.id && !used.has(o.id!) && o.account !== t.account && Math.abs(o.amount + t.amount) < 0.005 && days(o.date, t.date) <= 5);
    if (m) {
      used.add(t.id!);
      used.add(m.id!);
    } else if (!t.confirmed) out.push(t);
  }
  return out;
}

/** All-time one-off spending per extraordinary category, with its subcategories. */
export function extraordinaryTotals(all: Tx[], cx: CatIndex) {
  const out = new Map<string, { total: number; byCat: Map<string, number> }>();
  for (const t of all) {
    if (t.kind !== 'expense' || !cx.isExtra(t.categoryId)) continue;
    const r = cx.root(t.categoryId)!.id;
    const e = out.get(r) ?? { total: 0, byCat: new Map<string, number>() };
    e.total += -t.amount;
    e.byCat.set(t.categoryId!, (e.byCat.get(t.categoryId!) ?? 0) + -t.amount);
    out.set(r, e);
  }
  return out;
}

/**
 * An account's balance worked out from its movements: the opening balance (from the first statement line)
 * plus every movement since, including what you logged by hand. The latest statement balance is then used
 * as a check: if the movements up to that day don't add up to it, a statement or a movement is missing.
 */
export function computedBalance(all: Tx[], account: string) {
  const mine = all.filter((t) => t.account === account);
  const stmt = mine
    .filter((t) => t.source === 'import' && t.balance !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));
  if (!stmt.length) return null;
  const first = stmt[0];
  const last = stmt[stmt.length - 1];
  const opening = first.balance! - first.amount;
  const r = (n: number) => Math.round(n * 100) / 100;
  const importedSum = stmt.reduce((a, t) => a + t.amount, 0) + mine.filter((t) => t.source === 'import' && t.balance === undefined).reduce((a, t) => a + t.amount, 0);
  const mismatch = r(last.balance! - (opening + importedSum));
  const manualAfter = mine.filter((t) => t.source === 'manual' && t.date > last.date).length;
  return {
    balance: r(opening + mine.reduce((a, t) => a + t.amount, 0)),
    opening: r(opening),
    statementBalance: last.balance!,
    statementDate: last.date,
    mismatch: Math.abs(mismatch) > 0.005 ? mismatch : 0,
    manualAfter,
  };
}

/** The month a movement counts toward in reports. */
export const monthOf = (t: Tx) => t.statsMonth ?? t.date.slice(0, 7);

/**
 * With the "salary counts for next month" option, a salary received at the end of the month
 * (on or after the chosen day) is reported in the following month, when it's actually spent.
 * Only reports change; balances keep following the real dates.
 */
export function applySalaryShift(all: Tx[], settings: Settings, cx: CatIndex): Tx[] {
  const day = settings.salaryShiftDay;
  if (!day) return all;
  return all.map((t) =>
    t.kind === 'income' && cx.root(t.categoryId)?.id === 'salario' && Number(t.date.slice(8, 10)) >= day
      ? { ...t, statsMonth: shiftMonth(t.date.slice(0, 7), 1) }
      : t,
  );
}
