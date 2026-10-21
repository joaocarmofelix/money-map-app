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
    // 75 € by the 10th of a 31-day month is well ahead of pace
    expect(budgetStatus(75, 100, '2026-10', '2026-10-10').state).toBe('warn');
    // a bill paid early in the month is not
    expect(budgetStatus(45, 100, '2026-10', '2026-10-10').state).toBe('ok');
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

describe('extraordinary spending', () => {
  it('keeps house purchase costs out of monthly spending', () => {
    const cx = indexCategories(DEFAULT_CATEGORIES);
    const t = (categoryId: string, amount: number): Tx => ({ key: categoryId, account: 'mil', date: '2026-10-05', amount, description: 'x', kind: 'expense', categoryId, source: 'import' });
    const s = monthStats([t('cc-sinal', -5000), t('super', -40)], '2026-10', cx);
    expect(s.spent).toBe(40);
    expect(s.extra).toBe(5000);
    expect(s.byCat.get('casa-compra')).toBeUndefined();
  });
});

import { buildDemo } from '../src/lib/demo';
import { accountList, unpairedOwnTransfers as unp } from '../src/lib/stats';
describe('demo data', () => {
  it('is consistent', () => {
    const d = buildDemo('2026-10-14');
    expect(d.txs.length).toBeGreaterThan(150);
    expect(new Set(d.txs.map((t) => t.key)).size).toBe(d.txs.length);
    const acc = accountList(d.txs.map((t, i) => ({ ...t, id: i + 1 })), d.settings);
    expect(acc.find((a) => a.key === 'pot:_unassigned')).toBeUndefined();
    expect(acc.every((a) => a.balance > 0)).toBe(true);
    expect(unp(d.txs.map((t, i) => ({ ...t, id: i + 1 }))).length).toBe(1);
    const cx = indexCategories(DEFAULT_CATEGORIES);
    expect(d.txs.every((t) => !t.categoryId || cx.byId.has(t.categoryId))).toBe(true);
    console.log(acc.map((a) => `${a.name} ${a.balance}`).join(' | '));
  });
});

describe('matching what you logged by hand', () => {
  const man = (id: number, date: string, amount: number, account = 'mil', extra: Partial<Tx> = {}): Tx => ({ id, key: `m${id}`, account, date, amount, description: `manual ${id}`, kind: amount < 0 ? 'expense' : 'income', source: 'manual', categoryId: 'onepiece', ...extra });
  const s0 = { ownerNames: ['ANA SILVA TESTE'], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };
  const stmt = (rows: [string, number, string?][], account = 'mil') => {
    let bal = 1000;
    return rows.map(([date, amount, d]) => ({ account, date, amount, description: d ?? 'COMPRA 7782 LOJA DO TCG LISBOA', balance: (bal = Math.round((bal + amount) * 100) / 100) }));
  };

  it('pairs Wednesday and Saturday tournaments with their own day', () => {
    // logged Wed 1, Sat 4, Wed 8 (forgot Sat 11); bank posts each a day later
    const manual = [man(1, '2026-10-01', -10), man(2, '2026-10-04', -10), man(3, '2026-10-08', -10)];
    const parsed = stmt([['2026-10-02', -10], ['2026-10-05', -10], ['2026-10-09', -10], ['2026-10-12', -10]]);
    const plan = planImport(parsed, new Set(), manual, [], s0, []);
    const byManual = Object.fromEntries(plan.merges.map((m) => [m.manualId, plan.add.find((t) => t.key === m.key)!.date]));
    expect(byManual).toEqual({ 1: '2026-10-02', 2: '2026-10-05', 3: '2026-10-09' });
    const r = plan.recon[0];
    expect([r.manualCount, r.bankCount, r.matched, r.missing.count, r.leftover.length]).toEqual([3, 4, 3, 1, 0]);
    expect(r.missing.sum).toBe(10);
  });

  it('falls back to another account, merges income, and reports leftovers', () => {
    const manual = [man(1, '2026-10-03', -25, 'mil'), man(2, '2026-10-10', 300, 'bkt', { categoryId: 'reembolso' }), man(3, '2026-10-15', -12, 'mil')];
    const parsed = stmt([['2026-10-04', -25], ['2026-10-10', 300, 'TRF DE ALGUEM']], 'bkt');
    const plan = planImport(parsed, new Set(), manual, [], s0, []);
    expect(plan.merges.map((m) => m.manualId).sort()).toEqual([1, 2]);
    expect(plan.add.find((t) => t.amount === 300)?.categoryId).toBe('reembolso');
  });

  it('treats ATM withdrawals as cash, not spending', () => {
    const plan = planImport(stmt([['2026-10-04', -50, 'LEVANTAMENTO 7782 MB ALMADA']]), new Set(), [], [], s0, []);
    expect(plan.add[0]).toMatchObject({ kind: 'transfer', cash: true });
  });
});

import { nameInTransfer } from '../src/ui/People';
describe('people', () => {
  it('reads names from transfers', () => {
    expect(nameInTransfer('TRF MB WAY P/ MARIA EDUARDA CARMO FELIX CS')).toBe('MARIA EDUARDA CARMO FELIX');
    expect(nameInTransfer('TRF. P/O RICARDO ALEXANDRE DIAS CABRITA')).toBe('RICARDO ALEXANDRE DIAS CABRITA');
    expect(nameInTransfer('Trf Imediata p/ SANDRA VELOZA - Reconhec')).toBe('SANDRA VELOZA');
    expect(nameInTransfer('TRF P/ MillenniumBcp     Stocks')).toBeNull();
    expect(nameInTransfer('COMPRA 7782 LIDL')).toBeNull();
  });
  it('links imported transfers to a saved person', () => {
    const s0 = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };
    const parsed = [
      { account: 'mil', date: '2026-10-01', amount: -20, description: 'TRF MB WAY P/ MARIA EDUARDA CARMO FELIX CS', balance: 80 },
      { account: 'mil', date: '2026-10-02', amount: 30, description: 'TRF. P/O MARIA EDUARDA CARMO FELIX', balance: 110 },
    ];
    const plan = planImport(parsed, new Set(), [], [], s0, [], [{ id: 7, name: 'Maria', match: 'MARIA EDUARDA', relation: 'familia' }]);
    expect(plan.add.map((t) => [t.personId, t.categoryId])).toEqual([[7, 'familia'], [7, 'familia-in']]);
  });
});

import { computedBalance } from '../src/lib/stats';
import { debtsWith } from '../src/lib/tags';
describe('balance from movements', () => {
  const t = (id: number, date: string, amount: number, balance?: number, source: Tx['source'] = 'import'): Tx => ({ id, key: String(id), account: 'mil', date, amount, balance, description: 'x', kind: amount < 0 ? 'expense' : 'income', source });
  it('agrees with the statement when nothing is missing, and adds what you logged after', () => {
    const v = computedBalance([t(1, '2026-10-01', -10, 90), t(2, '2026-10-05', -20, 70), t(3, '2026-10-20', -5, undefined, 'manual')], 'mil')!;
    expect([v.opening, v.balance, v.mismatch, v.manualAfter]).toEqual([100, 65, 0, 1]);
  });
  it('flags a missing month', () => {
    // October and December imported, November (−200) missing
    const v = computedBalance([t(1, '2026-10-01', -10, 90), t(2, '2026-12-01', -10, -120)], 'mil')!;
    expect(v.mismatch).toBe(-200);
  });
});
describe('debts', () => {
  it('nets what they owe you against repayments', () => {
    const d = (id: number, amount: number, tag: string): Tx => ({ id, key: String(id), account: 'mil', date: '2026-10-01', amount, description: 'x', kind: amount < 0 ? 'expense' : 'income', source: 'import', personId: 1, tags: [tag] });
    expect(debtsWith([d(1, -40, 'A receber'), d(2, 25, 'Acerto de contas'), d(3, 15, 'Devo')], 1)).toEqual({ owesYou: 15, youOwe: 15, net: 0 });
  });
});

import { applySalaryShift } from '../src/lib/stats';
describe('salary counted for next month', () => {
  it('moves an end-of-month salary to the next month in reports only', () => {
    const cx = indexCategories(DEFAULT_CATEGORIES);
    const sal: Tx = { id: 1, key: 's', account: 'mil', date: '2025-10-30', amount: 1668, description: 'PAGAMENTO DE VENCIMENTO', kind: 'income', categoryId: 'salario', source: 'import' };
    const early: Tx = { ...sal, id: 2, key: 'e', date: '2025-10-10' };
    const s = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [], salaryShiftDay: 25 };
    const v = applySalaryShift([sal, early], s, cx);
    expect(monthStats(v, '2025-10', cx).income).toBe(1668);
    expect(monthStats(v, '2025-11', cx).income).toBe(1668);
    expect(applySalaryShift([sal], { ...s, salaryShiftDay: undefined }, cx)[0].statsMonth).toBeUndefined();
  });
});

describe('taking money out of an apparte', () => {
  it('recognises both sides and the apparte name', () => {
    const lines = `
CONTA MILLENNIUM N. 1 MOEDA: EUR
EXTRATO DE 2025/10/01 A 2025/10/31
SALDO INICIAL 73.52
10.02 10.02 TRF DE Apparte - Moneybox 100.00 173.52
10.22 10.22 TRF DE Apparte - Moneybox 250.00 423.52
SALDO FINAL 423.52
CONTA APPARTE N. 2 MOEDA: EUR
EXTRATO DE 2025/10/01 A 2025/10/31
SALDO INICIAL 5 500.00
10.02 10.02 TRF P/ ANA SILVA TESTE CS 100.00 5 400.00
10.22 10.22 TRF P/ ANA SILVA TESTE CS 250.00 5 150.00
SALDO FINAL 5 150.00
`.split('\n');
    const r = parseMillenniumLines(lines);
    const plan = planImport(r.txs, new Set(), [], [], { ownerNames: ['ANA SILVA TESTE'], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] }, []);
    expect(plan.add.map((t) => [t.account, t.kind, t.pot, t.amount])).toEqual([
      ['mil', 'transfer', 'Moneybox', 100],
      ['mil', 'transfer', 'Moneybox', 250],
      ['mil-apparte', 'transfer', 'Moneybox', -100],
      ['mil-apparte', 'transfer', 'Moneybox', -250],
    ]);
  });
});

describe('demo data', () => {
  it('only has valid dates, even on the first day of a month', () => {
    for (const day of ['2026-11-01', '2026-03-01', '2026-10-18']) {
      const { txs } = buildDemo(day);
      expect(txs.filter((t) => Number.isNaN(Date.parse(`${t.date}T12:00:00`)))).toEqual([]);
    }
  });
});

describe('Millennium months without leading zero', () => {
  it('reads January lines printed as "1.05"', () => {
    const lines = `CONTA MILLENNIUM N. 1 MOEDA: EUR
EXTRATO DE 2026/01/02 A 2026/01/30
SALDO INICIAL 1 000.00
1.02 1.02 COMPRA 1234 LOJA TESTE 25.00 975.00
1.29 1.29 PAGAMENTO DE VENCIMENTO 1 500.00 2 475.00
SALDO FINAL 2 475.00`.split('\n');
    const r = parseMillenniumLines(lines);
    expect(r.warnings).toEqual([]);
    expect(r.txs.map((t) => [t.date, t.amount])).toEqual([
      ['2026-01-02', -25],
      ['2026-01-29', 1500],
    ]);
  });
});

describe('apparte names', () => {
  it('reads the name with or without "TRF" and the dash', async () => {
    const { potName } = await import('../src/lib/classify');
    expect(potName('TRF DE Apparte - Moneybox')).toBe('Moneybox');
    expect(potName('Apparte - Moneybox')).toBe('Moneybox');
    expect(potName('APPARTE MONEYBOX')).toBe('MONEYBOX');
    expect(potName('Apparte Future Go', ['Future Goals'])).toBe('Future Goals');
    expect(potName('COMPRA 1234 LOJA TESTE')).toBeNull();
  });
});

describe('page layout', () => {
  it('keeps the saved order and slots in new sections', async () => {
    const { arrange } = await import('../src/lib/layout');
    expect(arrange('home')).toEqual(['accounts', 'goals', 'alerts', 'recent']);
    expect(arrange('home', ['recent', 'accounts'])).toEqual(['recent', 'accounts', 'goals', 'alerts']);
    expect(arrange('home', ['recent', 'gone', 'recent', 'alerts', 'goals', 'accounts'])).toEqual(['recent', 'alerts', 'goals', 'accounts']);
  });
});

describe('same balance twice on one day', () => {
  it('gives each movement its own key, and re-importing adds nothing', () => {
    const lines = `CONTA APPARTE N. 1 MOEDA: EUR
EXTRATO DE 2026/07/01 A 2026/07/31
SALDO INICIAL 1 000.00
7.08 7.08 TRF DE TESTE 100.00 1 100.00
7.08 7.08 TRF P/ TESTE 100.00 1 000.00
7.08 7.08 TRF DE TESTE 100.00 1 100.00
SALDO FINAL 1 100.00`.split('\n');
    const r = parseMillenniumLines(lines);
    const s = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };
    const plan = planImport(r.txs, new Set(), [], [], s, []);
    const keys = plan.add.map((t) => t.key);
    expect(new Set(keys).size).toBe(3);
    expect(planImport(r.txs, new Set(keys), [], [], s, []).add.length).toBe(0);
  });
});
