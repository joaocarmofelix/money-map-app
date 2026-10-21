import Dexie, { type Table } from 'dexie';
import { needsCategory } from './tags';
import type { Category, Goal, ImportFile, ImportLog, ParseResult, Person, Rule, Settings, Tx } from './types';
import { DEFAULT_CATEGORIES, HOUSE_IDS, LEGACY_IDS } from './categories';
import { buildDemo } from './demo';
import { planImport, reclassifyOpen } from './importer';
import { norm } from './text';
import { matchRule, personCategory, personFor } from './classify';

/**
 * Example data lives in its own database ("moneymap-demo"), so trying it never touches your real
 * movements. The choice is remembered on this device and takes effect on reload.
 */
const DEMO_FLAG = 'moneymap:demo-space';
export const inDemo = (() => {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
})();
export function setDemoSpace(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, '1');
    else localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* without storage the switch can't be remembered; stay where we are */
    return;
  }
  location.reload();
}

class MoneyMapDB extends Dexie {
  txs!: Table<Tx, number>;
  rules!: Table<Rule, number>;
  imports!: Table<ImportLog, number>;
  kv!: Table<{ k: string; v: unknown }, string>;
  categories!: Table<Category, string>;
  goals!: Table<Goal, number>;
  people!: Table<Person, number>;
  files!: Table<ImportFile, number>;
  constructor() {
    super(inDemo ? 'moneymap-demo' : 'moneymap');
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
    // v7: income mirrors the people subcategories of spending (Eu, Família, Amigos and any you added),
    // and side hustles exist on both sides.
    this.version(7).upgrade(async (tx) => {
      const cats = tx.table('categories');
      const all = (await cats.toArray()) as Category[];
      const byId = new Map(all.map((c) => [c.id, c]));
      const def = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
      const put = async (c: Category) => {
        await cats.put(c);
        byId.set(c.id, c);
      };
      const root = byId.get('pessoas-in');
      if (!root) await put(def.get('pessoas-in')!);
      else await put({ ...root, parentId: undefined, name: root.name === 'Recebido de pessoas' ? 'Pessoas' : root.name });
      const twin = (id: string) => (id === 'eu' ? 'eu-in' : `${id}-in`);
      for (const ch of all.filter((c) => c.parentId === 'pessoas')) {
        const id = twin(ch.id);
        const have = byId.get(id);
        if (have) await put({ ...have, parentId: 'pessoas-in', income: true, name: have.name === 'De contas minhas que não acompanho' ? ch.name : have.name });
        else await put({ ...ch, id, parentId: 'pessoas-in', income: true, budget: undefined, extraordinary: undefined });
      }
      for (const id of ['eu-in', 'familia-in', 'amigos-in']) {
        const have = byId.get(id);
        if (!have) await put(def.get(id)!);
        else if (have.parentId !== 'pessoas-in') await put({ ...have, parentId: 'pessoas-in', income: true });
      }
      const sh = byId.get('sidehustle');
      if (!sh) await put(def.get('sidehustle')!);
      else await put({ ...sh, hidden: false, name: sh.name === 'Side hustle' ? 'Side hustles' : sh.name });
      // Money received from a saved person goes to their group.
      const rel = new Map(((await tx.table('people').toArray()) as Person[]).map((p) => [p.id, p.relation]));
      await tx
        .table('txs')
        .filter((t: Tx) => t.categoryId === 'pessoas-in' && t.personId !== undefined)
        .modify((t: Tx) => {
          const r = rel.get(t.personId);
          if (r === 'familia' && byId.has('familia-in')) t.categoryId = 'familia-in';
          if (r === 'amigos' && byId.has('amigos-in')) t.categoryId = 'amigos-in';
        });
    });
    // v8: keep the statement file each import read.
    this.version(8).stores({ files: 'id' });
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

export async function runImport(fileName: string, parsed: ParseResult, file?: Blob) {
  return db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.people, db.files], async () => {
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
    if (file) await db.files.put({ id: importId, name: fileName, type: file.type, blob: file });
    // Movements from a deleted import come back with what you had given them.
    const kept = ((await db.kv.get(RESTORE_KEY))?.v ?? {}) as Record<string, KeptEdits>;
    for (const t of plan.add) {
      const k = kept[t.key];
      if (!k) continue;
      Object.assign(t, k);
      delete kept[t.key];
    }
    await db.kv.put({ k: RESTORE_KEY, v: kept });
    await db.txs.bulkAdd(plan.add.map((t) => ({ ...t, importId })));
    await db.txs.bulkDelete(plan.merges.map((m) => m.manualId));
    await refreshOpenIn();
    return plan;
  });
}

const RESTORE_KEY = 'restore';
/** What you set by hand on a movement; kept when its import is deleted, for when it comes back. */
type KeptEdits = Pick<Tx, 'categoryId' | 'tags' | 'personId' | 'note' | 'confirmed'>;

/** How many movements an import brought in (and how many of those you had logged by hand first). */
export async function importContents(importId: number) {
  const txs = await db.txs.filter((t) => t.importId === importId).toArray();
  return { count: txs.length, manual: txs.filter((t) => t.manualOrig).length };
}

/**
 * Undo an import: its movements, the stored file and the log entry go away, so the statement can be
 * imported again. Entries you had logged by hand come back as they were, and the categories, notes,
 * people and tags you gave its movements are kept aside and reapplied if the same movements return.
 */
export async function deleteImport(importId: number) {
  return db.transaction('rw', [db.txs, db.imports, db.files, db.kv], async () => {
    const txs = await db.txs.filter((t) => t.importId === importId).toArray();
    const kept = ((await db.kv.get(RESTORE_KEY))?.v ?? {}) as Record<string, KeptEdits>;
    for (const t of txs) {
      const k: KeptEdits = {};
      if (t.categoryId) k.categoryId = t.categoryId;
      if (t.tags?.length) k.tags = t.tags;
      if (t.personId) k.personId = t.personId;
      if (t.note) k.note = t.note;
      if (t.confirmed) k.confirmed = t.confirmed;
      if (Object.keys(k).length) kept[t.key] = k;
    }
    await db.kv.put({ k: RESTORE_KEY, v: kept });
    const manual = txs.filter((t) => t.manualOrig).map((t) => t.manualOrig!);
    if (manual.length) await db.txs.bulkAdd(manual);
    await db.txs.bulkDelete(txs.map((t) => t.id!));
    await db.files.delete(importId);
    await db.imports.delete(importId);
    return { removed: txs.length, manual: manual.length };
  });
}

async function refreshOpenIn() {
  const ups = reclassifyOpen(await db.txs.toArray(), await getSettings(), await db.rules.toArray(), await db.people.toArray());
  for (const u of ups) await db.txs.update(u.id, u.patch);
  return ups.length;
}

/** Re-checks uncategorised imported movements with the current rules (see reclassifyOpen). */
export async function refreshOpen() {
  return db.transaction('rw', [db.txs, db.rules, db.kv, db.people], refreshOpenIn);
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
    const open = await db.txs.filter(needsCategory).toArray();
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

async function toBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(s: string, type: string): Blob {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Everything in one JSON file, statement files included. */
export async function exportBackup(): Promise<string> {
  const files = await Promise.all((await db.files.toArray()).map(async (f) => ({ id: f.id, name: f.name, type: f.type, data: await toBase64(f.blob) })));
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
      files,
      settings: await getSettings(),
    },
    null,
    1,
  );
}

export async function restoreBackup(json: string) {
  const data = JSON.parse(json);
  if (data.app !== 'moneymap') throw new Error('Este ficheiro não é uma cópia de segurança desta app.');
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people, db.files], async () => {
    await db.files.clear();
    for (const f of (data.files ?? []) as { id: number; name: string; type: string; data: string }[]) {
      await db.files.put({ id: f.id, name: f.name, type: f.type, blob: fromBase64(f.data, f.type) });
    }
    await db.goals.clear();
    if (data.goals?.length) await db.goals.bulkAdd(data.goals);
    await db.people.clear();
    if (data.people?.length) await db.people.bulkAdd(data.people);
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear(), db.kv.delete(RESTORE_KEY)]);
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
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people, db.files], async () => {
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear(), db.goals.clear(), db.categories.clear(), db.people.clear(), db.files.clear(), db.kv.delete(RESTORE_KEY)]);
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
  await db.transaction('rw', [db.txs, db.rules, db.imports, db.kv, db.categories, db.goals, db.people, db.files], async () => {
    await Promise.all([db.txs.clear(), db.rules.clear(), db.imports.clear(), db.goals.clear(), db.categories.clear(), db.people.clear(), db.files.clear(), db.kv.delete(RESTORE_KEY)]);
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
    const { id: _id, ...orig } = m;
    await db.txs.update(importedId, { categoryId: m.categoryId ?? t.categoryId, note: m.note || m.description, tags: m.tags ?? t.tags, personId: m.personId ?? t.personId, manualOrig: orig });
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
