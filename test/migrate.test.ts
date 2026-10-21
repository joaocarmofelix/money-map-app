import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';

describe('v7 migration', () => {
  it('mirrors people subcategories into income and restores side hustles', async () => {
    const old = new Dexie('moneymap');
    old.version(6).stores({
      txs: '++id, &key, date, account, kind, categoryId, source, personId', rules: '++id, &pattern', imports: '++id, at', kv: 'k',
      categories: 'id, parentId, order', goals: '++id', people: '++id',
    });
    await old.open();
    await old.table('categories').bulkAdd([
      { id: 'pessoas', name: 'Pessoas', icon: 'handheart', color: 1, order: 1 },
      { id: 'eu', name: 'Eu (contas que não acompanho)', icon: 'wallet', color: 0, order: 2, parentId: 'pessoas' },
      { id: 'familia', name: 'Pais', icon: 'heart', color: 0, order: 3, parentId: 'pessoas', budget: 50 },
      { id: 'amigos', name: 'Amigos e contas divididas', icon: 'handheart', color: 0, order: 4, parentId: 'pessoas' },
      { id: 'c123', name: 'Maria', icon: 'tag', color: 0, order: 5, parentId: 'pessoas', hidden: true },
      { id: 'pessoas-in', name: 'Recebido de pessoas', icon: 'handheart', color: 4, order: 6, income: true },
      { id: 'eu-in', name: 'De contas minhas que não acompanho', icon: 'wallet', color: 1, order: 7, income: true },
      { id: 'sidehustle-in', name: 'Side hustles', icon: 'store', color: 0, order: 8, income: true },
    ]);
    await old.table('people').add({ name: 'Maria', match: 'MARIA', relation: 'familia' });
    await old.table('txs').add({ key: 'k1', account: 'mil', date: '2025-10-02', amount: 30, description: 'TRF MARIA', kind: 'income', source: 'import', categoryId: 'pessoas-in', personId: 1 });
    old.close();

    const { db } = await import('../src/lib/db');
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const kids = [...cats.values()].filter((c) => c.parentId === 'pessoas-in').map((c) => `${c.id}:${c.name}${c.hidden ? ' (off)' : ''}`).sort();
    expect(cats.get('pessoas-in')?.name).toBe('Pessoas');
    expect(kids).toEqual(['amigos-in:Amigos e contas divididas', 'c123-in:Maria (off)', 'eu-in:Eu (contas que não acompanho)', 'familia-in:Pais']);
    expect(cats.get('familia-in')?.budget).toBeUndefined();
    expect(cats.get('sidehustle')?.name).toBe('Side hustles');
    expect((await db.txs.get(1))?.categoryId).toBe('familia-in');
  });
});
