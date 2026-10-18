/**
 * Everything that only exists in the Android app: notifications, the home-screen widget,
 * links from the widget/notifications, and saving or sharing files. In the browser these are no-ops.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Settings } from './types';
import { MONTHS, fmt } from './text';

export const isNative = () => Capacitor.isNativePlatform();

const DAY = 86400000;

/** Where a notification or widget tap should take you. */
export type Target = 'add' | 'backup' | 'insights' | 'home';

/* ---------- notifications ---------- */

const at = (day: Date, hour: number) => {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
};
/** The first `hour` o'clock that is both after `from` and after now. */
const nextAt = (from: number, hour: number) => {
  let d = at(new Date(Math.max(from, Date.now())), hour);
  if (d.getTime() <= Date.now() || d.getTime() < from) d = new Date(d.getTime() + DAY);
  return d;
};

export interface ReminderState {
  settings: Settings;
}

/**
 * Re-plans the reminders from scratch every time the data changes, so they always reflect the
 * latest state: log something by hand and the "days without entries" reminders move forward.
 */
export async function syncReminders({ settings: s }: ReminderState) {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (s.companion === false || s.notifications === false) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    const list: { id: number; title: string; body: string; at: Date; go: Target }[] = [];
    // Log spending by hand: from the day it's due, every evening for a week.
    const days = s.remindManualDays ?? 3;
    if (days > 0 && s.lastManualAt) {
      const first = nextAt(s.lastManualAt + days * DAY, 20);
      for (let i = 0; i < 7; i++) {
        const when = new Date(first.getTime() + i * DAY);
        const n = Math.max(days, Math.floor((when.getTime() - s.lastManualAt) / DAY));
        list.push({ id: 100 + i, title: 'Gastaste alguma coisa?', body: `${n} dias sem apontar gastos. Leva só um segundo.`, at: when, go: 'add' });
      }
    }
    // Backup: when it's due, then once a week a few times.
    const months = s.remindBackupMonths ?? 6;
    if (months > 0) {
      const due = s.lastBackupAt ? s.lastBackupAt + months * 30.4 * DAY : Date.now() + DAY;
      const first = nextAt(due, 19);
      for (let i = 0; i < 4; i++) {
        list.push({ id: 200 + i, title: 'Cópia de segurança', body: s.lastBackupAt ? 'Já passou um tempo desde a última cópia. Guarda uma nova.' : 'Ainda não tens nenhuma cópia dos teus dados.', at: new Date(first.getTime() + i * 7 * DAY), go: 'backup' });
      }
    }
    // A new month starts: see how the last one went.
    const now = new Date();
    const firstOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0);
    const ended = MONTHS[now.getMonth()];
    list.push({ id: 300, title: 'Novo mês!', body: `Vê como correu ${ended.toLowerCase()} e se ficaste dentro dos orçamentos.`, at: firstOfNext, go: 'insights' });

    await LocalNotifications.schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        smallIcon: 'ic_stat_moneymap',
        iconColor: '#2547d0',
        extra: { go: n.go },
      })),
    });
  } catch (e) {
    console.warn('reminders', e);
  }
}

/** Asks Android for permission to show notifications (Android 13+ shows a prompt). */
export async function askNotifications(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/* ---------- widget ---------- */

interface WidgetPlugin {
  update(o: { title: string; amount: string; detail: string; progress: number; over: boolean }): Promise<void>;
}
const Widget = registerPlugin<WidgetPlugin>('MoneyMapWidget');

export async function updateWidget(o: { ym: string; spent: number; budget: number; budgetSpent: number }) {
  if (!isNative()) return;
  const month = MONTHS[Number(o.ym.slice(5)) - 1];
  const left = o.budget - o.budgetSpent;
  try {
    await Widget.update({
      title: `Gastos de ${month.toLowerCase()}`,
      amount: fmt(o.spent),
      detail: o.budget > 0 ? (left >= 0 ? `Restam ${fmt(left)} dos orçamentos` : `${fmt(-left)} acima dos orçamentos`) : 'Toca no + para apontar um gasto',
      progress: o.budget > 0 ? Math.round((o.budgetSpent / o.budget) * 100) : -1,
      over: o.budget > 0 && left < 0,
    });
  } catch (e) {
    console.warn('widget', e);
  }
}

/* ---------- links from the widget and notifications ---------- */

/** Calls `go` for the link the app was opened with, and for every later one. */
export function onOpenTarget(go: (t: Target) => void): () => void {
  if (!isNative()) return () => undefined;
  const fromUrl = (url?: string) => {
    const m = url?.match(/^moneymap:\/\/(\w+)/);
    if (m && ['add', 'backup', 'insights', 'home'].includes(m[1])) go(m[1] as Target);
  };
  App.getLaunchUrl().then((r) => fromUrl(r?.url)).catch(() => undefined);
  const subs = [
    App.addListener('appUrlOpen', (e) => fromUrl(e.url)),
    LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const t = e.notification.extra?.go;
      if (t) go(t as Target);
    }),
  ];
  return () => subs.forEach((s) => s.then((h) => h.remove()));
}

/** Runs `cb` whenever the app comes back to the foreground. */
export function onResume(cb: () => void): () => void {
  if (!isNative()) return () => undefined;
  const sub = App.addListener('resume', cb);
  return () => sub.then((h) => h.remove());
}

/* ---------- files ---------- */

const toB64 = async (b: Blob) => {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Opens Android's share sheet with a file (WhatsApp, Drive, email...). */
export async function shareFile(name: string, data: Blob | string, title: string) {
  const path = `share/${name}`;
  const res =
    typeof data === 'string'
      ? await Filesystem.writeFile({ path, data, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true })
      : await Filesystem.writeFile({ path, data: await toB64(data), directory: Directory.Cache, recursive: true });
  await Share.share({ title, files: [res.uri] });
}

/** Saves a file in the phone's Documents/MoneyMap folder. Returns where it went. */
export async function saveFile(name: string, data: Blob | string): Promise<string> {
  const path = `MoneyMap/${name}`;
  if (typeof data === 'string') await Filesystem.writeFile({ path, data, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  else await Filesystem.writeFile({ path, data: await toB64(data), directory: Directory.Documents, recursive: true });
  return `Documentos/MoneyMap/${name}`;
}
