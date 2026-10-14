import Dexie, { type Table } from 'dexie';
import type { ImportLog, ParseResult, Rule, Settings, Tx } from './types';
import { planImport } from './importer';
import { norm } from './text';
import { matchRule } from './classify';

class GastosDB extends Dexie {
  txs!: Table<Tx, number>;
  rules!: Table<Rule, number>;
  imports!: Table<ImportLog, number>;
  kv!: Table<{ k: string; v: unknown }, string>;
  constructor() {
    super('gastos');
    this.version(1).stores({
      txs: '++id, &key, date, account, kind, categoryId, source',
      rules: '++id, &pattern',
      imports: '++id, at',
      kv: 'k',
    });
  }
}

export const db = new GastosDB();

const DEFAULT_SETTINGS: Settings = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {} };

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.v as Partial<Settings>) };
}

export async function saveSettings(s: Settings) {
  await db.kv.put({ k: 'settings', v: s });
}

export async function knownPots(): Promise<string[]> {
  const t = await db.txs.where('kind').equals('transfer').toArray();
  return [...new Set(t.filter((x) => x.pot && x.account !== 'mil-apparte').map((x) => x.pot!))];
}

export async function runImport(fileName: string, parsed: ParseResult) {
  return db.transaction('rw', db.txs, db.rules, db.imports, db.kv, async () => {
    const existing = new Set((await db.txs.toArray()).map((t) => t.key));
    const manual = await db.txs.where('source').equals('manual').toArray();
    const plan = planImport(parsed.txs, existing, manual, await db.rules.toArray(), await getSettings(), await knownPots());
    const dates = parsed.txs.map((t) => t.date).sort();
    const importId = await db.imports.add({
      at: Date.now(),
      fileName,
      account: parsed.bank,
      added: plan.add.length,
      skipped: plan.skipped,
      merged: plan.merges.length,
      from: dates[0],
      to: dates[dates.length - 1],
    });
    await db.txs.bulkAdd(plan.add.map((t) => ({ ...t, importId })));
    await db.txs.bulkDelete(plan.merges.map((m) => m.manualId));
    return plan;
  });
}

/**
 * Categorize one transaction and remember it as a rule.
 * Returns how many other uncategorized transactions the rule picked up.
 */
export async function categorize(txId: number, categoryId: string, pattern: string | null) {
  return db.transaction('rw', db.txs, db.rules, async () => {
    await db.txs.update(txId, { categoryId });
    if (!pattern) return 0;
    const p = norm(pattern);
    if (!p) return 0;
    const existing = await db.rules.where('pattern').equals(p).first();
    if (existing) await db.rules.update(existing.id!, { categoryId });
    else await db.rules.add({ pattern: p, categoryId, createdAt: Date.now() });
    const rules = await db.rules.toArray();
    const open = await db.txs.filter((t) => !t.categoryId && t.kind !== 'transfer').toArray();
    let n = 0;
    for (const t of open) {
      const r = matchRule(t.description, rules, t.kind);
      if (r?.pattern === p) {
        await db.txs.update(t.id!, { categoryId });
        n++;
      }
    }
    return n;
  });
}

export async function exportBackup(): Promise<string> {
  return JSON.stringify(
    {
      app: 'gastos',
      version: 1,
      exportedAt: new Date().toISOString(),
      txs: await db.txs.toArray(),
      rules: await db.rules.toArray(),
      imports: await db.imports.toArray(),
      settings: await getSettings(),
    },
    null,
    1,
  );
}

export async function restoreBackup(json: string) {
  const data = JSON.parse(json);
  if (data.app !== 'gastos') throw new Error('Este ficheiro não é uma cópia de segurança desta app.');
  await db.transaction('rw', db.txs, db.rules, db.imports, db.kv, async () => {
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear()]);
    await db.txs.bulkAdd(data.txs);
    await db.rules.bulkAdd(data.rules);
    await db.imports.bulkAdd(data.imports ?? []);
    await saveSettings(data.settings);
  });
}
