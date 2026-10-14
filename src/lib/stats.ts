import type { Settings, Tx } from './types';
import { FOOD_IDS } from './categories';

export interface MonthStats {
  spent: number;
  income: number;
  food: number;
  foodTxs: Tx[];
  toPots: number;
  byCategory: { id: string; total: number; count: number }[];
  uncategorized: number;
}

export function monthStats(all: Tx[], ym: string): MonthStats {
  const txs = all.filter((t) => t.date.startsWith(ym));
  const by = new Map<string, { total: number; count: number }>();
  let spent = 0;
  let income = 0;
  let food = 0;
  let toPots = 0;
  let uncategorized = 0;
  const foodTxs: Tx[] = [];
  for (const t of txs) {
    if (t.kind === 'transfer') {
      if (t.account === 'mil-apparte') toPots += t.amount;
      continue;
    }
    if (!t.categoryId) uncategorized++;
    if (t.kind === 'income') {
      income += t.amount;
      continue;
    }
    spent += -t.amount;
    const id = t.categoryId ?? '_none';
    const e = by.get(id) ?? { total: 0, count: 0 };
    e.total += -t.amount;
    e.count++;
    by.set(id, e);
    if (t.categoryId && FOOD_IDS.has(t.categoryId)) {
      food += -t.amount;
      foodTxs.push(t);
    }
  }
  return {
    spent,
    income,
    food,
    foodTxs: foodTxs.sort((a, b) => a.amount - b.amount),
    toPots,
    byCategory: [...by.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total),
    uncategorized,
  };
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
  const sorted = [...all].filter((t) => t.balance !== undefined).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));
  for (const t of sorted) out[t.account] = { balance: t.balance!, date: t.date };
  return out;
}
