import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { nudges } from '../src/ui/Companion';
import type { Settings } from '../src/lib/types';

const base: Settings = { ownerNames: [], potStart: {}, trackFrom: '', investStart: {}, hiddenAccounts: [] };
const DAY = 86400000;
const now = Date.parse('2026-10-17T12:00:00Z');

describe('companion reminders', () => {
  it('asks for a first backup and for manual entries after the chosen days', () => {
    expect(nudges({ ...base, lastManualAt: now - DAY }, now).map((n) => n.id)).toEqual(['backup']);
    expect(nudges({ ...base, lastBackupAt: now - 10 * DAY, lastManualAt: now - 4 * DAY }, now).map((n) => n.id)).toEqual(['manual']);
    expect(nudges({ ...base, lastBackupAt: now - 200 * DAY, lastManualAt: now }, now).map((n) => n.id)).toEqual(['backup']);
    expect(nudges({ ...base, lastBackupAt: now - 200 * DAY, remindBackupMonths: 0, lastManualAt: now - 9 * DAY, remindManualDays: 0 }, now)).toEqual([]);
    expect(nudges({ ...base, companion: false }, now)).toEqual([]);
  });

  it('warns about budgets first, celebrates a good month early in the next one, and respects dismissals', () => {
    const s = { ...base, lastBackupAt: now, lastManualAt: now };
    const pulse = {
      now: [
        { id: 'comerfora', name: 'Comer fora', state: 'warn' as const, pct: 0.9, left: 17 },
        { id: 'lazer', name: 'Hobbies', state: 'over' as const, pct: 1.2, left: -30 },
      ],
      prev: { ym: '2026-09', label: 'Setembro', met: 5, total: 5 },
    };
    const early = Date.parse('2026-10-03T12:00:00Z');
    const list = nudges(s, early, pulse);
    expect(list.map((n) => n.id)).toEqual(['budget-over:lazer:2026-10', 'celebrate:2026-09']);
    expect(list[0].text).toContain('Hobbies');
    expect(list[1].mood).toBe('party');
    // past the first week, no celebration
    expect(nudges(s, now, { ...pulse, now: [] }).map((n) => n.id)).toEqual([]);
    // dismissed budget warning hides only that one
    expect(nudges({ ...s, pinHidden: { 'budget-over:lazer:2026-10': early + 1000 } }, early, pulse).map((n) => n.id)).toEqual(['celebrate:2026-09']);
    // partial month gives a recap, not a party
    expect(nudges(s, early, { now: [], prev: { ym: '2026-09', label: 'Setembro', met: 3, total: 5 } })[0].id).toBe('recap:2026-09');
  });
});

describe('backup with statement files', () => {
  it('keeps the original file through export and restore', async () => {
    const { db, runImport, exportBackup, restoreBackup } = await import('../src/lib/db');
    await db.open();
    const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 0, 255, 128])], { type: 'application/pdf' });
    await runImport('extrato.pdf', { bank: 'Millennium', txs: [{ account: 'mil', date: '2025-10-02', amount: -5, description: 'CAFE', balance: 95 }], warnings: [] } as never, pdf);
    const json = await exportBackup();
    await db.files.clear();
    await restoreBackup(json);
    const f = (await db.files.toArray())[0];
    expect(f.name).toBe('extrato.pdf');
    expect([...new Uint8Array(await f.blob.arrayBuffer())]).toEqual([37, 80, 68, 70, 0, 255, 128]);
  });
});
