import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { clearAll, db, deleteImport, importContents, runImport } from '../src/lib/db';
import type { ParseResult } from '../src/lib/types';

const statement: ParseResult = {
  bank: 'Millennium',
  warnings: [],
  closing: {},
  txs: [
    { account: 'mil', date: '2026-01-05', amount: -12.5, description: 'COMPRA 1111 CAFE TESTE', balance: 987.5 },
    { account: 'mil', date: '2026-01-06', amount: -40, description: 'COMPRA 1111 LOJA TESTE', balance: 947.5 },
  ],
};

describe('deleting an import', () => {
  it('removes its movements, brings back hand-logged entries and keeps your categories for a re-import', async () => {
    await clearAll();
    // Logged by hand before the statement arrived.
    await db.txs.add({ key: 'manual|1', account: 'mil', date: '2026-01-06', amount: -40, description: 'Prenda', kind: 'expense', categoryId: 'compras', source: 'manual' });

    await runImport('jan.pdf', statement, new Blob(['x'], { type: 'application/pdf' }));
    const imp = (await db.imports.toArray())[0];
    expect(await importContents(imp.id!)).toEqual({ count: 2, manual: 1 });
    expect(await db.txs.where('source').equals('manual').count()).toBe(0);
    const cafe = (await db.txs.toArray()).find((t) => t.description.includes('CAFE'))!;
    await db.txs.update(cafe.id!, { categoryId: 'restaurantes', note: 'com a Ana' });

    expect(await deleteImport(imp.id!)).toEqual({ removed: 2, manual: 1 });
    const left = await db.txs.toArray();
    expect(left.map((t) => [t.source, t.description, t.categoryId])).toEqual([['manual', 'Prenda', 'compras']]);
    expect(await db.imports.count()).toBe(0);
    expect(await db.files.count()).toBe(0);

    // Import again: nothing is "already imported", the hand entry is matched again, the café keeps its category.
    const plan = await runImport('jan.pdf', statement);
    expect(plan.add.length).toBe(2);
    const back = await db.txs.toArray();
    expect(back.length).toBe(2);
    expect(back.find((t) => t.description.includes('CAFE'))).toMatchObject({ categoryId: 'restaurantes', note: 'com a Ana' });
    expect(back.find((t) => t.description.includes('LOJA'))).toMatchObject({ categoryId: 'compras', source: 'import' });
  });
});
