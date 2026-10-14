import type { Settings, Tx } from './types';
import { INVESTMENTS, type CatIndex } from './categories';
import { shiftMonth } from './text';

export interface MonthStats {
  spent: number;
  income: number;
  food: number;
  foodTxs: Tx[];
  toPots: number;
  toInvest: number;
  /** Spending per top-level category ('_none' = uncategorized) */
  byRoot: { id: string; total: number; count: number }[];
  /** Spending per category id, including what its subcategories spent */
  byCat: Map<string, number>;
  uncategorized: number;
}

export function monthStats(all: Tx[], ym: string, cx: CatIndex): MonthStats {
  const txs = all.filter((t) => t.date.startsWith(ym));
  const roots = new Map<string, { total: number; count: number }>();
  const byCat = new Map<string, number>();
  let spent = 0;
  let income = 0;
  let food = 0;
  let toPots = 0;
  let toInvest = 0;
  let uncategorized = 0;
  const foodTxs: Tx[] = [];
  for (const t of txs) {
    if (t.kind === 'transfer') {
      if (t.account === 'mil-apparte') toPots += t.amount;
      if (t.invest) toInvest += -t.amount;
      continue;
    }
    if (!t.categoryId) uncategorized++;
    if (t.kind === 'income') {
      income += t.amount;
      continue;
    }
    const v = -t.amount;
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
    if (cx.isFood(t.categoryId)) {
      food += v;
      foodTxs.push(t);
    }
  }
  return {
    spent,
    income,
    food,
    foodTxs: foodTxs.sort((a, b) => a.amount - b.amount),
    toPots,
    toInvest,
    byRoot: [...roots.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total),
    byCat,
    uncategorized,
  };
}

export function history(all: Tx[], endYm: string, n: number, cx: CatIndex) {
  const out: { ym: string; spent: number; food: number; income: number; hasData: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = shiftMonth(endYm, -i);
    const s = monthStats(all, ym, cx);
    out.push({ ym, spent: s.spent, food: s.food, income: s.income, hasData: all.some((t) => t.date.startsWith(ym)) });
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
  else if (pct >= 0.85 || (current && elapsed >= 0.25 && projected > budget * 1.05)) state = 'warn';
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
