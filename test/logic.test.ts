import { describe, it, expect } from 'vitest';
import { parseMillenniumLines } from '../src/lib/parsers/millennium';
import { planImport } from '../src/lib/importer';
import { matchRule } from '../src/lib/classify';
import { suggestPattern } from '../src/lib/text';
import type { Tx } from '../src/lib/types';

// Synthetic statement in the Millennium layout (no real data).
const LINES = `
CONTA MILLENNIUM N. 1 MOEDA: EUR
EXTRATO DE 2026/10/01 A 2026/10/31
SALDO INICIAL 1 000.00
10.01 10.01 COMPRA 1234 LIDL AGRADECE AMADORA CONTACTLESS 10.00 990.00
10.01 10.01 COMPRA 1234 LIDL AGRADECE AMADORA CONTACTLESS 10.00 980.00
10.02 10.02 TRF P/ MillenniumBcp Future Goals 200.00 780.00
10.03 10.03 TRF P/ ANA SILVA TESTE 20.00 760.00
10.04 10.04 COMPRA 1234 UBER EATS PARIS 15.50 744.50
10.30 10.30 PAGAMENTO DE VENCIMENTO 1 500.00 2 244.50
SALDO FINAL 2 244.50
CONTA APPARTE N. 2 MOEDA: EUR
EXTRATO DE 2026/10/01 A 2026/10/31
SALDO INICIAL 0.00
10.02 10.02 TRF DE Transferencia MillenniumBcp Future Go 200.00 200.00
SALDO FINAL 200.00
`.split('\n');

const settings = { ownerNames: ['ANA SILVA TESTE'], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };

describe('millennium parser', () => {
  const r = parseMillenniumLines(LINES);
  it('reads signed amounts from the running balance', () => {
    expect(r.warnings).toEqual([]);
    expect(r.txs.map((t) => t.amount)).toEqual([-10, -10, -200, -20, -15.5, 1500, 200]);
    expect(r.closing).toEqual({ mil: 2244.5, 'mil-apparte': 200 });
  });

  it('marks pots and own transfers, keeps identical coffees, and is idempotent', () => {
    const plan = planImport(r.txs, new Set(), [], [], settings, []);
    expect(plan.add).toHaveLength(7);
    const byDesc = (s: string) => plan.add.filter((t) => t.description.includes(s));
    expect(byDesc('Future').map((t) => [t.kind, t.pot])).toEqual([
      ['transfer', 'Future Goals'],
      ['transfer', 'Future Goals'],
    ]);
    expect(byDesc('ANA SILVA')[0].kind).toBe('transfer');
    expect(byDesc('VENCIMENTO')[0].kind).toBe('income');
    expect(new Set(byDesc('LIDL').map((t) => t.key)).size).toBe(2);
    const again = planImport(r.txs, new Set(plan.add.map((t) => t.key)), [], [], settings, []);
    expect(again.add).toHaveLength(0);
    expect(again.skipped).toBe(7);
  });

  it('applies rules and replaces a quick-added expense', () => {
    const manual: Tx[] = [
      { id: 9, key: 'm9', account: 'mil', date: '2026-10-03', amount: -15.5, description: 'jantar', kind: 'expense', source: 'manual', categoryId: 'delivery' },
    ];
    const rules = [{ pattern: 'LIDL', categoryId: 'super', createdAt: 0 }];
    const plan = planImport(r.txs, new Set(), manual, rules, settings, []);
    expect(plan.add.filter((t) => t.categoryId === 'super')).toHaveLength(2);
    expect(plan.merges).toEqual([{ manualId: 9, key: expect.stringContaining('-15.50') }]);
    expect(plan.add.find((t) => t.amount === -15.5)?.categoryId).toBe('delivery');
  });
});

describe('rules', () => {
  it('suggests sensible patterns', () => {
    expect(suggestPattern('COMPRA 7782 LIDL MONTE CAPARICA CASAS VELHAS')).toBe('LIDL');
    expect(suggestPattern('COMPRA 7782 A CUNHA CELORICO BASTO CONTACTLESS')).toBe('A CUNHA');
    expect(suggestPattern('COMPRA 7782 A8 LOURES CONTACTLESS')).toBe('A8');
    expect(suggestPattern('TRF MB WAY P/ MARIA EDUARDA X CS')).toBe('MARIA EDUARDA');
  });
  it('matches whole words, longest first', () => {
    const rules = [
      { pattern: 'UBER', categoryId: 'transp', createdAt: 0 },
      { pattern: 'UBER EATS', categoryId: 'delivery', createdAt: 0 },
      { pattern: 'A8', categoryId: 'portagens', createdAt: 0 },
    ];
    expect(matchRule('COMPRA 1 UBER EATS PARIS', rules)?.categoryId).toBe('delivery');
    expect(matchRule('COMPRA 1 UBER BV', rules)?.categoryId).toBe('transp');
    expect(matchRule('COMPRA 1 A81 X', rules)).toBeUndefined();
  });
});

describe('kind-aware rules', () => {
  it('does not apply an income rule to an expense', () => {
    const rules = [{ pattern: 'MARIA EDUARDA', categoryId: 'outros-in', createdAt: 0, income: true }];
    expect(matchRule('TRF MB WAY P/ MARIA EDUARDA X', rules, 'expense')).toBeUndefined();
    expect(matchRule('TRF. P/O MARIA EDUARDA X', rules, 'income')?.categoryId).toBe('outros-in');
  });
});

describe('start date and investments', () => {
  it('drops movements before trackFrom and treats Trading 212 as investment', () => {
    const parsed = [
      { account: 'mil', date: '2025-09-30', amount: -5, description: 'COMPRA 1 CAFE', balance: 95 },
      { account: 'mil', date: '2025-10-01', amount: -100, description: 'TRF P/ Trading 212 Markets Ltd', balance: -5 },
    ];
    const s = { ownerNames: [], potStart: {}, trackFrom: '2025-10-01', investStart: { t212: 1741 }, hiddenAccounts: [] };
    const plan = planImport(parsed, new Set(), [], [], s, []);
    expect(plan.tooOld).toBe(1);
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({ kind: 'transfer', invest: 't212' });
  });
});

import { budgetStatus, monthStats } from '../src/lib/stats';
import { DEFAULT_CATEGORIES, indexCategories } from '../src/lib/categories';

describe('categories and budgets', () => {
  const cx = indexCategories(DEFAULT_CATEGORIES);
  it('rolls subcategory spending up to the parent', () => {
    const t = (categoryId: string, amount: number): Tx => ({ key: categoryId + amount, account: 'mil', date: '2026-10-05', amount, description: 'x', kind: 'expense', categoryId, source: 'import' });
    const s = monthStats([t('onepiece', -30), t('lazer', -10), t('super', -20)], '2026-10', cx);
    expect(s.byCat.get('lazer')).toBe(40);
    expect(s.byCat.get('onepiece')).toBe(30);
    expect(s.byRoot.find((r) => r.id === 'lazer')?.total).toBe(40);
    
  });
  it('flags budgets by amount and by pace', () => {
    expect(budgetStatus(120, 100, '2026-09', '2026-10-14').state).toBe('over');
    expect(budgetStatus(90, 100, '2026-09', '2026-10-14').state).toBe('warn');
    expect(budgetStatus(40, 100, '2026-09', '2026-10-14').state).toBe('ok');
    // 60 € by the 10th of a 31-day month projects ~186 €
    expect(budgetStatus(60, 100, '2026-10', '2026-10-10').state).toBe('warn');
  });
});

import { buildSuggester, triageOrder } from '../src/lib/suggest';

describe('suggestions from history', () => {
  const mk = (description: string, categoryId?: string, amount = -10): Tx => ({ key: description + Math.random(), account: 'mil', date: '2026-10-01', amount, description, kind: amount < 0 ? 'expense' : 'income', categoryId, source: 'import' });
  it('proposes the category you used for the same merchant', () => {
    const s = buildSuggester([mk('COMPRA 7782 PINGO DOCE LISBOA', 'super'), mk('COMPRA 7782 PINGO DOCE PORTO', 'super'), mk('COMPRA 7782 PINGO DOCE X', 'rest')]);
    expect(s(mk('COMPRA 7782 PINGO DOCE C BASTO CONTACTLESS'))).toEqual({ categoryId: 'super', count: 2, seen: 3 });
    expect(s(mk('COMPRA 7782 WORTEN LISBOA'))).toBeNull();
  });
  it('puts big groups of similar movements first', () => {
    const order = triageOrder([mk('COMPRA 7782 FNAC A'), mk('COMPRA 7782 LIDL A'), mk('COMPRA 7782 LIDL B'), mk('COMPRA 7782 LIDL C')]);
    expect(order[0].tx.description).toContain('LIDL');
    expect(order[0].similar).toBe(2);
    expect(order[3].tx.description).toContain('FNAC');
  });
});

import { unpairedOwnTransfers } from '../src/lib/stats';
describe('own transfers', () => {
  const tr = (id: number, account: string, date: string, amount: number, extra: Partial<Tx> = {}): Tx => ({ id, key: String(id), account, date, amount, description: 'TRF', kind: 'transfer', source: 'import', ...extra });
  it('pairs Millennium → Bankinter and flags the one that went elsewhere', () => {
    const list = [tr(1, 'mil', '2026-10-01', -500), tr(2, 'bkt', '2026-10-02', 500), tr(3, 'mil', '2026-10-05', -70), tr(4, 'mil', '2026-10-06', -100, { pot: 'Stocks' }), tr(5, 'mil', '2026-10-07', -30, { confirmed: true })];
    expect(unpairedOwnTransfers(list).map((t) => t.id)).toEqual([3]);
  });
});
