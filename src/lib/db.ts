import Dexie, { type Table } from 'dexie';
import type { Category, Goal, ImportLog, ParseResult, Person, Rule, Settings, Tx } from './types';
import { DEFAULT_CATEGORIES, HOUSE_IDS, LEGACY_IDS } from './categories';
import { buildDemo } from './demo';
import { planImport } from './importer';
import { norm } from './text';
import { matchRule, personCategory, personFor } from './classify';

class MoneyMapDB extends Dexie {
  txs!: Table<Tx, number>;
  rules!: Table<Rule, number>;
  imports!: Table<ImportLog, number>;
  kv!: Table<{ k: string; v: unknown }, string>;
  categories!: Table<Category, string>;
  goals!: Table<Goal, number>;
  people!: Table<Person, number>;
  constructor() {
    super('moneymap');
    this.version(1).stores({
      txs: '++id, &key, date, account, kind, categoryId, source',
      rules: '++id, &pattern',
      imports: '++id, at',
      kv: 'k',
    });
    this.version(2)
      .stores({ categories: 'id, parentId, order' })
      .upgrade((tx) => tx.table('categories').bulkPut(DEFAULT_CATEGORIES));
    // v3: icons instead of emoji, fuller category list, goals.
    this.version(3)
      .stores({ goals: '++id' })
      .upgrade(async (tx) => {
        const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
        const old = (await tx.table('categories').toArray()) as (Category & { emoji?: string })[];
        const custom = old.filter((c) => !ids.has(c.id) && !(c.id in LEGACY_IDS)).map(({ emoji: _e, ...c }) => ({ ...c, icon: 'tag' }));
        const budgets = new Map(old.filter((c) => c.budget).map((c) => [LEGACY_IDS[c.id] ?? c.id, c.budget]));
        await tx.table('categories').clear();
        await tx.table('categories').bulkAdd([...DEFAULT_CATEGORIES.map((c) => ({ ...c, budget: budgets.get(c.id) })), ...custom]);
        const remap = (id?: string) => (id && LEGACY_IDS[id]) || id;
        await tx.table('txs').toCollection().modify((t: Tx) => {
          t.categoryId = remap(t.categoryId);
        });
        await tx.table('rules').toCollection().modify((r: Rule) => {
          r.categoryId = remap(r.categoryId)!;
        });
      });
    // v4: categories for money moved to/from your own accounts that the app doesn't track.
    this.version(4).upgrade(async (tx) => {
      const have = new Set(((await tx.table('categories').toCollection().primaryKeys()) as string[]));
      await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.filter((c) => ['eu', 'familia', 'amigos', 'eu-in'].includes(c.id) && !have.has(c.id)));
    });
    // v5: house purchase categories (one-off spending) and a rule for Bankinter mortgage-process fees.
    this.version(5).upgrade(async (tx) => {
      const have = new Set((await tx.table('categories').toCollection().primaryKeys()) as string[]);
      await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.filter((c) => HOUSE_IDS.includes(c.id) && !have.has(c.id)));
      if (!(await tx.table('rules').where('pattern').equals('PHB').count())) {
        await tx.table('rules').add({ pattern: 'PHB', categoryId: 'cc-credito', createdAt: Date.now() });
      }
      await tx
        .table('txs')
        .filter((t: Tx) => !t.categoryId && t.kind === 'expense' && /\bPHB\b/i.test(t.description))
        .modify({ categoryId: 'cc-credito' });
    });
    // v6: people you send money to or receive from.
    this.version(6)
      .stores({ people: '++id', txs: '++id, &key, date, account, kind, categoryId, source, personId' })
      .upgrade(async (tx) => {
        const have = new Set((await tx.table('categories').toCollection().primaryKeys()) as string[]);
        await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.filter((c) => c.id === 'pessoas-in' && !have.has(c.id)));
      });
    this.on('populate', (tx) => {
      tx.table('rules').add({ pattern: 'PHB', categoryId: 'cc-credito', createdAt: Date.now() });
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES);
    });
  }
}

export const db = new MoneyMapDB();

const DEFAULT_SETTINGS: Settings = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.v as Partial<Settings>) };
}

export async function saveSettings(s: Settings) {
  await db.kv.put({ k: 'settings', v: s });
}

/** Atomic read-modify-write, so two quick edits never overwrite each other. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.kv, async () => {
    const next = { ...(await getSettings()), ...patch };
    await db.kv.put({ k: 'settings', v: next });
    return next;
  });
}

export async function knownPots(): Promise<string[]> {
  const t = await db.txs.where('kind').equals('transfer').toArray();
  return [...new Set(t.filter((x) => x.pot && x.account !== 'mil-apparte').map((x) => x.pot!))];
}

export async function runImport(fileName: string, parsed: ParseResult) {
  return db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.people], async () => {
    const existing = new Set((await db.txs.toArray()).map((t) => t.key));
    const manual = await db.txs.where('source').equals('manual').toArray();
    const plan = planImport(parsed.txs, existing, manual, await db.rules.toArray(), await getSettings(), await knownPots(), await db.people.toArray());
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
    const income = (await db.txs.get(txId))?.kind === 'income';
    await db.txs.update(txId, { categoryId });
    if (!pattern) return 0;
    const p = norm(pattern);
    if (!p) return 0;
    const existing = await db.rules.where('pattern').equals(p).first();
    if (existing) await db.rules.update(existing.id!, { categoryId, income });
    else await db.rules.add({ pattern: p, categoryId, income, createdAt: Date.now() });
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
      app: 'moneymap',
      version: 1,
      exportedAt: new Date().toISOString(),
      txs: await db.txs.toArray(),
      rules: await db.rules.toArray(),
      categories: await db.categories.toArray(),
      goals: await db.goals.toArray(),
      people: await db.people.toArray(),
      imports: await db.imports.toArray(),
      settings: await getSettings(),
    },
    null,
    1,
  );
}

export async function restoreBackup(json: string) {
  const data = JSON.parse(json);
  if (data.app !== 'moneymap') throw new Error('Este ficheiro não é uma cópia de segurança desta app.');
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people], async () => {
    await db.goals.clear();
    if (data.goals?.length) await db.goals.bulkAdd(data.goals);
    await db.people.clear();
    if (data.people?.length) await db.people.bulkAdd(data.people);
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear()]);
    if (data.categories?.length) {
      await db.categories.clear();
      await db.categories.bulkAdd(data.categories);
    }
    await db.txs.bulkAdd(data.txs);
    await db.rules.bulkAdd(data.rules);
    await db.imports.bulkAdd(data.imports ?? []);
    await saveSettings(data.settings);
  });
}

/** Delete a category: its movements, rules and subcategories move to the parent (or become uncategorized). */
export async function deleteCategory(id: string) {
  await db.transaction('rw', db.txs, db.rules, db.categories, async () => {
    const cat = await db.categories.get(id);
    if (!cat) return;
    const to = cat.parentId;
    await db.txs.where('categoryId').equals(id).modify({ categoryId: to });
    for (const r of (await db.rules.toArray()).filter((r) => r.categoryId === id)) {
      if (to) await db.rules.update(r.id!, { categoryId: to });
      else await db.rules.delete(r.id!);
    }
    await db.categories.where('parentId').equals(id).modify({ parentId: to });
    await db.categories.delete(id);
  });
}

/** Replace everything with the example data set. */
export async function loadDemo(todayIso: string) {
  const d = buildDemo(todayIso);
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people], async () => {
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear(), db.goals.clear(), db.categories.clear(), db.people.clear()]);
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, budget: d.budgets[c.id] })));
    await db.txs.bulkAdd(d.txs);
    await db.rules.bulkAdd(d.rules);
    await db.goals.bulkAdd(d.goals);
    await db.people.bulkAdd(d.people);
    await db.kv.put({ k: 'settings', v: d.settings });
  });
}

/** Delete all data and start over with the default categories. */
export async function clearAll(keepDismissed = true) {
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people], async () => {
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear(), db.goals.clear(), db.categories.clear(), db.people.clear()]);
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    await db.rules.add({ pattern: 'PHB', categoryId: 'cc-credito', createdAt: Date.now() });
    await db.kv.put({ k: 'settings', v: { ...DEFAULT_SETTINGS, demoDismissed: keepDismissed } });
  });
}

/** Join a hand-logged entry to a bank movement you picked: the bank movement keeps your category and note. */
export async function mergeManual(manualId: number, importedId: number) {
  await db.transaction('rw', db.txs, async () => {
    const m = await db.txs.get(manualId);
    const t = await db.txs.get(importedId);
    if (!m || !t) return;
    await db.txs.update(importedId, { categoryId: m.categoryId ?? t.categoryId, note: m.note || m.description });
    await db.txs.delete(manualId);
  });
}

/** Link a person to their transfers (past ones too) and give uncategorized ones the matching category. */
export async function linkPerson(person: Person) {
  await db.transaction('rw', db.txs, async () => {
    const all = await db.txs.filter((t) => t.kind !== 'transfer' && t.source === 'import').toArray();
    for (const t of all) {
      const hit = personFor(t.description, [person]);
      if (hit) await db.txs.update(t.id!, { personId: person.id, categoryId: t.categoryId ?? personCategory(person, t.amount) });
      else if (t.personId === person.id) await db.txs.update(t.id!, { personId: undefined });
    }
  });
}
