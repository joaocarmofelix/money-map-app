import type { Tx } from './types';
import { merchantText, suggestPattern } from './text';

export interface Suggestion {
  categoryId: string;
  /** How many past movements from this merchant had that category */
  count: number;
  /** How many past movements from this merchant there were in total */
  seen: number;
}

const firstWord = (desc: string) => merchantText(desc).split(' ').find((w) => /[A-Z]{3,}/.test(w)) ?? '';

/**
 * Learns from what you already categorized: movements from the same merchant
 * (same key word as the rule suggestion, or the same first word) vote for their category.
 * Nothing is applied automatically; the app only proposes it.
 */
export function buildSuggester(history: Tx[]) {
  const byKey = new Map<string, Map<string, number>>();
  const byWord = new Map<string, Map<string, number>>();
  const add = (m: Map<string, Map<string, number>>, k: string, cat: string) => {
    if (!k) return;
    const e = m.get(k) ?? new Map<string, number>();
    e.set(cat, (e.get(cat) ?? 0) + 1);
    m.set(k, e);
  };
  for (const h of history) {
    if (!h.categoryId || h.kind === 'transfer') continue;
    add(byKey, `${h.kind}|${suggestPattern(h.description)}`, h.categoryId);
    add(byWord, `${h.kind}|${firstWord(h.description)}`, h.categoryId);
  }
  const best = (votes?: Map<string, number>): Suggestion | null => {
    if (!votes) return null;
    let top: Suggestion | null = null;
    let seen = 0;
    for (const [categoryId, count] of votes) {
      seen += count;
      if (!top || count > top.count) top = { categoryId, count, seen: 0 };
    }
    return top ? { ...top, seen } : null;
  };
  return (t: Tx): Suggestion | null =>
    best(byKey.get(`${t.kind}|${suggestPattern(t.description)}`)) ?? best(byWord.get(`${t.kind}|${firstWord(t.description)}`));
}

/** Uncategorized movements ordered so the biggest groups of similar ones come first. */
export function triageOrder(open: Tx[]): { tx: Tx; similar: number }[] {
  const groups = new Map<string, number>();
  for (const t of open) {
    const k = `${t.kind}|${suggestPattern(t.description)}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  return open
    .map((tx) => ({ tx, similar: (groups.get(`${tx.kind}|${suggestPattern(tx.description)}`) ?? 1) - 1 }))
    .sort((a, b) => b.similar - a.similar || b.tx.date.localeCompare(a.tx.date));
}
