import { describe, it, expect } from 'vitest';
import { reclassifyOpen } from '../src/lib/importer';
import type { Tx } from '../src/lib/types';

const s = { ownerNames: ['JOAO PEDRO CARMO FELIX'], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };
const tx = (id: number, account: Tx['account'], amount: number, description: string, kind: Tx['kind'], extra: Partial<Tx> = {}): Tx =>
  ({ id, key: String(id), account, date: '2025-10-22', amount, description, kind, source: 'import', ...extra });

describe('reclassifyOpen', () => {
  it('turns old uncategorised apparte withdrawals and own transfers into transfers', () => {
    const all = [
      tx(1, 'mil', 250, 'TRF DE Apparte - Moneybox', 'income'),
      tx(2, 'mil-apparte', -250, 'TRF P/ JOAO PEDRO CARMO FELIX CS', 'transfer'),
      tx(3, 'mil', 50, 'TRF. P/O JOAO PEDRO CARMO FELIX', 'income'),
      tx(4, 'mil', 50, 'TRF DE TRANSFERENCIA PERMANENTE', 'income'),
      tx(5, 'mil', 250, 'TRF DE Apparte - Moneybox', 'income', { categoryId: 'outros-in' }),
    ];
    const ups = new Map(reclassifyOpen(all, s, []).map((u) => [u.id, u.patch]));
    expect(ups.get(1)).toMatchObject({ kind: 'transfer', pot: 'Moneybox' });
    expect(ups.get(2)).toMatchObject({ pot: 'Moneybox' });
    expect(ups.get(3)).toMatchObject({ kind: 'transfer' });
    expect(ups.has(4)).toBe(false); // unknown sender stays for you to categorise
    expect(ups.has(5)).toBe(false); // you already categorised it
  });
});

import { planImport } from '../src/lib/importer';
describe('withdrawals from several appartes', () => {
  it('names each apparte from the main account line, also on the apparte side', () => {
    const p = (account: 'mil' | 'mil-apparte', date: string, amount: number, description: string, balance: number) => ({ account, date, amount, description, balance });
    const parsed = [
      p('mil', '2025-11-05', 100, 'TRF DE Apparte - Fun', 1100),
      p('mil', '2025-11-05', 300, 'TRF DE Apparte - Stocks', 1400),
      p('mil', '2025-11-20', 300, 'TRF DE Apparte - Future Goals', 1700),
      p('mil-apparte', '2025-11-05', -100, 'TRF P/ JOAO PEDRO CARMO FELIX CS', 900),
      p('mil-apparte', '2025-11-05', -300, 'TRF P/ JOAO PEDRO CARMO FELIX CS', 600),
      p('mil-apparte', '2025-11-20', -300, 'TRF P/ JOAO PEDRO CARMO FELIX CS', 300),
    ];
    const { add } = planImport(parsed, new Set(), [], [], s, []);
    expect(add.map((t) => `${t.account} ${t.amount} ${t.kind} ${t.pot}`)).toEqual([
      'mil 100 transfer Fun', 'mil 300 transfer Stocks', 'mil 300 transfer Future Goals',
      'mil-apparte -100 transfer Fun', 'mil-apparte -300 transfer Stocks', 'mil-apparte -300 transfer Future Goals',
    ]);
  });
});

import { classify, isCashDeposit } from '../src/lib/classify';
describe('cash deposits', () => {
  it('treats paying cash into the bank as a transfer from Dinheiro, not income', () => {
    for (const d of ['DEP NUMERARIO 7782 ALMADA', 'DEPOSITO EM NUMERARIO', 'DEP. ATM 1234', 'Ingreso en efectivo']) expect(isCashDeposit(d)).toBe(true);
    for (const d of ['DEPOSITO A PRAZO', 'PAGAMENTO DE VENCIMENTO', 'TRF DE MARIA']) expect(isCashDeposit(d)).toBe(false);
    expect(classify({ account: 'mil', date: '2025-11-03', amount: 120, description: 'DEP NUMERARIO ATM ALMADA' }, [], [])).toEqual({ kind: 'transfer', cash: true });
    expect(classify({ account: 'mil', date: '2025-11-03', amount: -120, description: 'DEP NUMERARIO ATM ALMADA' }, [], []).kind).toBe('expense');
  });
});
