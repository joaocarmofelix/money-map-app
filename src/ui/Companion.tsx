import { useEffect, useState } from 'react';
import { Dice5, RotateCcw, X } from 'lucide-react';
import { Sheet } from './kit';
import type { PinLook, Settings } from '../lib/types';

export type { PinLook };
import { getSettings, updateSettings } from '../lib/db';
import { fmt } from '../lib/text';

export type Mood = 'happy' | 'alert' | 'party';

export const DEFAULT_LOOK: PinLook = { color: 'mint', eyes: 'round', mouth: 'smile', nose: 'none', glasses: 'none', hair: 'none', detail: 'blush' };

export const COLORS: Record<PinLook['color'], [string, string]> = {
  mint: ['#2fd08f', '#1baf7a'],
  sky: ['#4cc3ff', '#2a9fd8'],
  orange: ['#ff9f43', '#e07a1f'],
  pink: ['#ff7eb3', '#e0558f'],
  purple: ['#a78bfa', '#7f62e6'],
  yellow: ['#ffd43b', '#e5ae00'],
  coral: ['#ff7a6b', '#e5574a'],
  lime: ['#a3e635', '#7cb518'],
};

/** A small heart centred on 0,0, about 10 wide. */
const HEART = 'M0 4C-6-.5-4.5-5.5 0-2.6C4.5-5.5 6-.5 0 4Z';

const INK = '#0f1b3d';
const HAIR = '#3b2a20';

function Eyes({ kind }: { kind: PinLook['eyes'] }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'big':
      return (
        <g className="m-eyes">
          <ellipse cx="23" cy="29" rx="5" ry="6" fill={INK} />
          <ellipse cx="41" cy="29" rx="5" ry="6" fill={INK} />
          <circle cx="24.8" cy="26.6" r="2" fill="#fff" />
          <circle cx="42.8" cy="26.6" r="2" fill="#fff" />
          <circle cx="21.6" cy="31.4" r=".9" fill="#fff" />
          <circle cx="39.6" cy="31.4" r=".9" fill="#fff" />
        </g>
      );
    case 'happy':
      return (
        <g>
          <path d="M19 30.5q4-5.5 8 0" {...line} />
          <path d="M37 30.5q4-5.5 8 0" {...line} />
        </g>
      );
    case 'sleepy':
      return (
        <g>
          <path d="M19.2 28.5a3.8 3.8 0 0 0 7.6 0z" fill={INK} />
          <path d="M37.2 28.5a3.8 3.8 0 0 0 7.6 0z" fill={INK} />
          <path d="M18.6 28.5h8.8M36.6 28.5h8.8" {...line} strokeWidth={2} />
        </g>
      );
    case 'hearts':
      return (
        <g className="m-eyes">
          <path d={HEART} transform="translate(23 29) scale(.95)" fill="#ff4d6d" />
          <path d={HEART} transform="translate(41 29) scale(.95)" fill="#ff4d6d" />
        </g>
      );
    case 'dots':
      return (
        <g className="m-eyes">
          <circle cx="23" cy="29.5" r="2.3" fill={INK} />
          <circle cx="41" cy="29.5" r="2.3" fill={INK} />
        </g>
      );
    case 'wink':
      return (
        <g>
          <ellipse cx="23" cy="29" rx="3.8" ry="4.8" fill={INK} />
          <circle cx="24.4" cy="27.2" r="1.3" fill="#fff" />
          <path d="M37 30q4-4 8 0" {...line} />
        </g>
      );
    default:
      return (
        <g className="m-eyes">
          <ellipse cx="23" cy="29" rx="3.8" ry="4.8" fill={INK} />
          <ellipse cx="41" cy="29" rx="3.8" ry="4.8" fill={INK} />
          <circle cx="24.4" cy="27.2" r="1.3" fill="#fff" />
          <circle cx="42.4" cy="27.2" r="1.3" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ kind, mood }: { kind: PinLook['mouth']; mood: Mood }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (mood === 'alert') return <ellipse cx="32" cy="40.5" rx="3.2" ry="3.8" fill={INK} />;
  switch (kind) {
    case 'grin':
      return (
        <g>
          <path d="M25 37.5h14a7 7 0 0 1-14 0z" fill={INK} />
          <path d="M26.6 37.5h10.8v2.1H26.6z" fill="#fff" />
          <path d="M28.5 42.3q3.5-2.4 7 0a7 7 0 0 1-7 0z" fill="#ff5c8a" />
        </g>
      );
    case 'cat':
      return <path d="M26 38q3 3.4 6 0q3 3.4 6 0" {...line} />;
    case 'tongue':
      return (
        <g>
          <path d="M31 40.4h6v2.2a3 3 0 0 1-6 0z" fill="#ff5c8a" stroke={INK} strokeWidth={1.4} />
          <path d="M26 38.5q6 5 12 0" {...line} />
        </g>
      );
    case 'flat':
      return <path d="M27 39.5h10" {...line} />;
    case 'teeth':
      return (
        <g>
          <path d="M29.6 39.6h2.3v3.1h-2.3zM32.1 39.6h2.3v3.1h-2.3z" fill="#fff" stroke={INK} strokeWidth={0.9} />
          <path d="M26 38.2q6 3.8 12 0" {...line} />
        </g>
      );
    case 'smirk':
      return <path d="M27 40q6 2 10.5-2.6" {...line} />;
    default:
      return <path d="M26 38.5q6 6 12 0" {...line} />;
  }
}

function Nose({ kind, shade }: { kind: PinLook['nose']; shade: string }) {
  if (kind === 'dot') return <circle cx="32" cy="34.2" r="1.4" fill={INK} />;
  if (kind === 'button') return <ellipse cx="32" cy="34.4" rx="2.8" ry="2" fill={shade} />;
  if (kind === 'triangle') return <path d="M32 32.4l2.4 3.6h-4.8z" fill={shade} strokeLinejoin="round" />;
  return null;
}

function Glasses({ kind }: { kind: PinLook['glasses'] }) {
  const st = { stroke: INK, strokeWidth: 2, fill: 'rgb(255 255 255 / .18)' };
  const arms = <path d="M16 27.5L8 25.5M48 27.5L56 25.5" stroke={INK} strokeWidth={2} strokeLinecap="round" />;
  switch (kind) {
    case 'round':
      return (
        <g>
          {arms}
          <circle cx="23" cy="29" r="7" {...st} />
          <circle cx="41" cy="29" r="7" {...st} />
          <path d="M30 28q2-2 4 0" fill="none" stroke={INK} strokeWidth={2} />
        </g>
      );
    case 'square':
    case 'sun': {
      const fill = kind === 'sun' ? INK : st.fill;
      return (
        <g>
          {arms}
          <rect x="15.5" y="23" width="15" height="12" rx="3.5" {...st} fill={fill} />
          <rect x="33.5" y="23" width="15" height="12" rx="3.5" {...st} fill={fill} />
          <path d="M30.5 27.5h3" stroke={INK} strokeWidth={2} />
          {kind === 'sun' && <path d="M18.5 26.5l4-2.5M36.5 26.5l4-2.5" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity=".7" />}
        </g>
      );
    }
    case 'heart':
      return (
        <g>
          {arms}
          <path d={HEART} transform="translate(23 29.5) scale(1.55)" fill="#ff4d6d" stroke={INK} strokeWidth={1.2} />
          <path d={HEART} transform="translate(41 29.5) scale(1.55)" fill="#ff4d6d" stroke={INK} strokeWidth={1.2} />
          <path d="M30 27.5q2-1.6 4 0" fill="none" stroke={INK} strokeWidth={2} />
        </g>
      );
    case 'monocle':
      return (
        <g>
          <circle cx="41" cy="29" r="7.5" fill="rgb(255 255 255 / .2)" stroke="#d99a00" strokeWidth={2.2} />
          <path d="M41 36.5q5 9-2 17" fill="none" stroke="#d99a00" strokeWidth={1.3} />
        </g>
      );
    default:
      return null;
  }
}

function Hair({ kind }: { kind: PinLook['hair'] }) {
  switch (kind) {
    case 'tuft':
      return <path d="M28 6q-3-7 1-11M32 5q0-8 5-11M36 6q4-6 8-6" fill="none" stroke={HAIR} strokeWidth={3} strokeLinecap="round" />;
    case 'cap':
      return (
        <g>
          <path d="M8.6 19A26 26 0 0 1 55.4 19Z" fill="#e8453c" />
          <path d="M30 17.2h27.5a2.7 2.7 0 0 1 0 5.4H30z" fill="#b8312a" />
          <circle cx="32" cy="4.4" r="2.2" fill="#b8312a" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M8.6 19A26 26 0 0 1 55.4 19Z" fill="#6c5ce7" />
          <rect x="7" y="15.5" width="50" height="7" rx="3.5" fill="#5446c9" />
          <circle cx="32" cy="2" r="4.6" fill="#fff" />
        </g>
      );
    case 'bow':
      return (
        <g transform="rotate(18 45 8)">
          <path d="M45 8l-10-6.5v13zM45 8l10-6.5v13z" fill="#ff5c8a" />
          <circle cx="45" cy="8" r="2.8" fill="#e0457a" />
        </g>
      );
    case 'crown':
      return <path d="M19 9l3-12 6 7 4-9 4 9 6-7 3 12z" fill="#ffd43b" stroke="#d99a00" strokeWidth={1.4} strokeLinejoin="round" />;
    case 'tophat':
      return (
        <g>
          <rect x="19.5" y="-9" width="25" height="19" rx="2.5" fill="#1f2937" />
          <rect x="19.5" y="3.5" width="25" height="4" fill="#e8453c" />
          <rect x="11" y="8.5" width="42" height="4.4" rx="2.2" fill="#1f2937" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M8.5 29A23.5 23.5 0 0 1 55.5 29" fill="none" stroke="#1f2937" strokeWidth={3.6} strokeLinecap="round" />
          <rect x="2.5" y="23.5" width="8.5" height="15" rx="4.2" fill="#e8453c" />
          <rect x="53" y="23.5" width="8.5" height="15" rx="4.2" fill="#e8453c" />
        </g>
      );
    case 'party':
      return (
        <g transform="rotate(-12 32 6)">
          <path d="M32-9l10 19q-10 3.5-20 0z" fill="#a78bfa" />
          <path d="M28.5-2.4l7 0M26 4.6h12" stroke="#ffd43b" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx="32" cy="-9" r="3" fill="#ff5c8a" />
        </g>
      );
    case 'sprout':
      return (
        <g>
          <path d="M32 5q0-6 1.5-9.5" fill="none" stroke="#178a4c" strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx="27.5" cy="-4" rx="5" ry="2.6" transform="rotate(-25 27.5 -4)" fill="#4cd07d" />
          <ellipse cx="38.5" cy="-6" rx="5" ry="2.6" transform="rotate(25 38.5 -6)" fill="#4cd07d" />
        </g>
      );
    default:
      return null;
  }
}

function Detail({ kind }: { kind: PinLook['detail'] }) {
  if (kind === 'blush')
    return (
      <g>
        <circle cx="16.5" cy="37" r="3.6" fill="#ff8fab" opacity=".6" />
        <circle cx="47.5" cy="37" r="3.6" fill="#ff8fab" opacity=".6" />
      </g>
    );
  if (kind === 'freckles')
    return (
      <g fill="#8a4b2a" opacity=".65">
        {[[14.5, 35.5], [18, 37.5], [14.8, 39.5], [49.5, 35.5], [46, 37.5], [49.2, 39.5]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />
        ))}
      </g>
    );
  if (kind === 'bandaid')
    return (
      <g transform="rotate(-28 47 36.5)">
        <rect x="41" y="34" width="12" height="5" rx="2.5" fill="#f5c9a0" stroke="#d29a6a" strokeWidth=".8" />
        <rect x="45.2" y="34.6" width="3.6" height="3.8" rx=".8" fill="#e8b48a" />
      </g>
    );
  if (kind === 'brows') return <path d="M18.5 21.5q4.5-3.4 9-.6M36.5 20.9q4.5-2.8 9 .6" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />;
  if (kind === 'mustache') return <path d="M24 37q4-4.2 8-1q4-3.2 8 1q-4 1.8-8-.4q-4 2.2-8 .4z" fill={HAIR} />;
  return null;
}

/** Pin, the app's companion: a little map pin with a face. Bobs gently and blinks. */
export function Mascot({ mood = 'happy', size = 64, className = '', look }: { mood?: Mood; size?: number; className?: string; look?: Partial<PinLook> }) {
  const l = { ...DEFAULT_LOOK, ...look };
  const [main, shade] = COLORS[l.color] ?? COLORS.mint;
  return (
    <svg className={`mascot m-${mood} ${className}`} width={size} height={(size * 90) / 64} viewBox="0 -10 64 90" aria-hidden>
      <ellipse className="m-shadow" cx="32" cy="76" rx="12" ry="2.6" />
      {mood === 'party' && (
        <g className="m-confetti">
          <rect x="2" y="6" width="4" height="7" rx="1" fill="#ffd43b" />
          <rect x="56" y="2" width="4" height="7" rx="1" fill="#ff5c8a" transform="rotate(25 58 5)" />
          <circle cx="60" cy="22" r="2.4" fill="#4cc3ff" />
          <circle cx="4" cy="26" r="2.2" fill="#a78bfa" />
          <path d="M50-6l1.5 3 3 .4-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.4z" fill="#ffd43b" />
          <path d="M12-4l1.2 2.4 2.6.3-1.9 1.7.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.7 2.6-.3z" fill="#2fd08f" />
        </g>
      )}
      <g className="m-body">
        <path d="M32 72C26 64 6 47 6 30a26 26 0 0 1 52 0c0 17-20 34-26 42z" fill={main} />
        <path d="M32 72C29 68 22 61 16 52c8 6 22 6 32 0-6 9-13 16-16 20z" fill={shade} opacity=".55" />
        <ellipse cx="19" cy="17" rx="4.5" ry="7.5" transform="rotate(30 19 17)" fill="#fff" opacity=".35" />
        <Detail kind={l.detail} />
        <g className="m-look">
          <Eyes kind={l.eyes} />
        </g>
        <Nose kind={l.nose} shade={shade} />
        <Mouth kind={l.mouth} mood={mood} />
        <Glasses kind={l.glasses} />
        <Hair kind={l.hair} />
      </g>
    </svg>
  );
}

export interface Nudge {
  /** Unique per reminder, so dismissing one doesn't hide the others */
  id: string;
  text: string;
  action: string;
  /** What the button does */
  go: 'backup' | 'add' | 'budgets' | 'dismiss';
  mood: Mood;
  /** How long ✕ (or "dismiss" actions) hide it */
  hideFor: number;
}

/** Budgets as the companion sees them: this month so far, and how last month ended. */
export interface BudgetPulse {
  now: { id: string; name: string; state: 'ok' | 'warn' | 'over'; pct: number; left: number }[];
  prev?: { ym: string; label: string; met: number; total: number };
}

const DAY = 86400000;

/** What the companion wants to tell you right now, most urgent first. */
export function nudges(s: Settings, now = Date.now(), pulse?: BudgetPulse): Nudge[] {
  if (s.companion === false) return [];
  const out: Nudge[] = [];
  const ym = new Date(now).toISOString().slice(0, 7);
  if (pulse) {
    const worst = [...pulse.now].filter((b) => b.state !== 'ok').sort((a, b) => b.pct - a.pct)[0];
    if (worst?.state === 'over') out.push({ id: `budget-over:${worst.id}:${ym}`, text: `${worst.name} passou o orçamento em ${fmt(-worst.left)}!`, action: 'Ver', go: 'budgets', mood: 'alert', hideFor: DAY });
    else if (worst) out.push({ id: `budget-warn:${worst.id}:${ym}`, text: `${worst.name}: restam só ${fmt(worst.left)} este mês.`, action: 'Ver', go: 'budgets', mood: 'alert', hideFor: DAY });
    const p = pulse.prev;
    const day = new Date(now).getDate();
    if (p && p.total > 0 && day <= 7) {
      if (p.met === p.total) out.push({ id: `celebrate:${p.ym}`, text: `${p.label}: todos os orçamentos cumpridos! 🎉`, action: 'Boa!', go: 'dismiss', mood: 'party', hideFor: 40 * DAY });
      else if (p.met > 0) out.push({ id: `recap:${p.ym}`, text: `${p.label}: cumpriste ${p.met} de ${p.total} orçamentos.`, action: 'Ver', go: 'budgets', mood: 'happy', hideFor: 40 * DAY });
    }
  }
  const months = s.remindBackupMonths ?? 6;
  if (months > 0) {
    if (!s.lastBackupAt) out.push({ id: 'backup', text: 'Ainda não tens cópia de segurança!', action: 'Guardar', go: 'backup', mood: 'alert', hideFor: DAY });
    else {
      const ago = (now - s.lastBackupAt) / DAY;
      if (ago >= months * 30.4) out.push({ id: 'backup', text: `${Math.floor(ago / 30.4)} ${Math.floor(ago / 30.4) === 1 ? 'mês' : 'meses'} sem cópia de segurança!`, action: 'Guardar', go: 'backup', mood: 'alert', hideFor: DAY });
    }
  }
  const days = s.remindManualDays ?? 3;
  if (days > 0 && s.lastManualAt) {
    const ago = Math.floor((now - s.lastManualAt) / DAY);
    if (ago >= days) out.push({ id: 'manual', text: `${ago} dias sem apontar gastos. Gastaste algo?`, action: 'Apontar', go: 'add', mood: 'alert', hideFor: DAY });
  }
  const hidden = s.pinHidden ?? {};
  return out.filter((n) => !(hidden[n.id] > now));
}

/** The companion on the net-worth card, plus its speech bubble. */
export function useCompanion(settings: Settings, actions: { backup: () => void; add: () => void; budgets: () => void }, pulse?: BudgetPulse) {
  const [poke, setPoke] = useState(0);
  const on = settings.companion !== false;
  // Start counting days without manual entries from the first time the companion runs.
  useEffect(() => {
    if (on && !settings.lastManualAt) updateSettings({ lastManualAt: Date.now() });
  }, [on, settings.lastManualAt]);
  // A tap makes Pin jump; the class comes off when the jump ends so the next tap plays it again.
  useEffect(() => {
    if (!poke) return;
    const t = setTimeout(() => setPoke(0), 750);
    return () => clearTimeout(t);
  }, [poke]);
  const now = Date.now();
  const shown = on ? nudges(settings, now, pulse)[0] : undefined;
  const showBubble = !!shown;
  const hide = async (n: Nudge) => {
    const fresh = await getSettings();
    // Drop expired entries so the list doesn't grow forever.
    const kept = Object.fromEntries(Object.entries(fresh.pinHidden ?? {}).filter(([, until]) => until > Date.now()));
    await updateSettings({ pinHidden: { ...kept, [n.id]: Date.now() + n.hideFor } });
  };

  const mascot = on ? (
    <button className="hero-mascot" onClick={() => setPoke((n) => n + 1)} aria-label="Pin">
      <Mascot mood={shown?.mood ?? 'happy'} size={66} look={settings.pin} className={poke ? `m-poke m-poke-${poke % 2}` : ''} />
    </button>
  ) : null;

  const bubble = showBubble ? (
    <div className="pin-say" role="status">
      <span className="pin-say-t">{shown!.text}</span>
      <button
        className="pin-say-go"
        onClick={() => {
          const n = shown!;
          if (n.go === 'backup') actions.backup();
          else if (n.go === 'add') actions.add();
          else if (n.go === 'budgets') {
            hide(n);
            actions.budgets();
          } else hide(n);
        }}
      >
        {shown!.action}
      </button>
      <button className="pin-say-x" aria-label="Esconder" title={shown!.hideFor > DAY ? 'Esconder' : 'Lembrar amanhã'} onClick={() => hide(shown!)}>
        <X size={14} />
      </button>
    </div>
  ) : null;

  return { mascot, bubble };
}

type Part = keyof PinLook;

const PARTS: { id: Part; label: string; options: { v: string; label: string }[] }[] = [
  { id: 'color', label: 'Cor', options: [
    { v: 'mint', label: 'Menta' }, { v: 'sky', label: 'Céu' }, { v: 'orange', label: 'Laranja' },
    { v: 'pink', label: 'Rosa' }, { v: 'purple', label: 'Roxo' }, { v: 'yellow', label: 'Amarelo' },
    { v: 'coral', label: 'Coral' }, { v: 'lime', label: 'Lima' },
  ] },
  { id: 'eyes', label: 'Olhos', options: [
    { v: 'round', label: 'Redondos' }, { v: 'big', label: 'Brilhantes' }, { v: 'happy', label: 'Contentes' },
    { v: 'sleepy', label: 'Ensonados' }, { v: 'wink', label: 'Piscar' }, { v: 'hearts', label: 'Apaixonado' },
    { v: 'dots', label: 'Pontinhos' },
  ] },
  { id: 'mouth', label: 'Boca', options: [
    { v: 'smile', label: 'Sorriso' }, { v: 'grin', label: 'Risada' }, { v: 'cat', label: 'Gato' },
    { v: 'tongue', label: 'Língua' }, { v: 'flat', label: 'Sério' }, { v: 'teeth', label: 'Dentolas' },
    { v: 'smirk', label: 'Maroto' },
  ] },
  { id: 'nose', label: 'Nariz', options: [
    { v: 'none', label: 'Sem' }, { v: 'dot', label: 'Ponto' }, { v: 'button', label: 'Botão' }, { v: 'triangle', label: 'Bico' },
  ] },
  { id: 'glasses', label: 'Óculos', options: [
    { v: 'none', label: 'Sem' }, { v: 'round', label: 'Redondos' }, { v: 'square', label: 'Quadrados' },
    { v: 'sun', label: 'De sol' }, { v: 'heart', label: 'Corações' }, { v: 'monocle', label: 'Monóculo' },
  ] },
  { id: 'hair', label: 'Cabeça', options: [
    { v: 'none', label: 'Nada' }, { v: 'tuft', label: 'Topete' }, { v: 'cap', label: 'Boné' }, { v: 'beanie', label: 'Gorro' },
    { v: 'bow', label: 'Laço' }, { v: 'crown', label: 'Coroa' }, { v: 'sprout', label: 'Rebento' },
    { v: 'tophat', label: 'Cartola' }, { v: 'headphones', label: 'Auscultadores' }, { v: 'party', label: 'Festa' },
  ] },
  { id: 'detail', label: 'Detalhes', options: [
    { v: 'blush', label: 'Bochechas' }, { v: 'freckles', label: 'Sardas' }, { v: 'mustache', label: 'Bigode' },
    { v: 'brows', label: 'Sobrolhos' }, { v: 'bandaid', label: 'Penso' }, { v: 'none', label: 'Nada' },
  ] },
];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Character creator: choose Pin's colour, face and accessories. Every choice saves straight away. */
export function PinCreator({ look, onClose }: { look?: Partial<PinLook>; onClose: () => void }) {
  const [cur, setCur] = useState<PinLook>({ ...DEFAULT_LOOK, ...look });
  const [tab, setTab] = useState<Part>('color');
  const save = (next: PinLook) => {
    setCur(next);
    updateSettings({ pin: next });
  };
  const part = PARTS.find((p) => p.id === tab)!;
  return (
    <Sheet onClose={onClose} label="Personalizar o Pin" title="Personalizar o Pin" tall>
      <div className="stack" style={{ gap: 12 }}>
        <div className="pc-stage">
          <Mascot size={96} look={cur} />
          <span className="pc-name">Pin</span>
        </div>
        <div className="pc-tabs chips" role="toolbar" aria-label="Partes">
          {PARTS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={tab === p.id} onClick={() => setTab(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="pc-grid" role="radiogroup" aria-label={part.label}>
          {part.options.map((o) => {
            const on = cur[tab] === o.v;
            return (
              <button key={o.v} className="pc-opt" role="radio" aria-checked={on} aria-pressed={on} onClick={() => save({ ...cur, [tab]: o.v } as PinLook)}>
                {tab === 'color' ? (
                  <span className="pc-swatch" style={{ background: COLORS[o.v as PinLook['color']][0] }} />
                ) : (
                  <Mascot size={46} look={{ ...cur, [tab]: o.v }} />
                )}
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="pc-actions">
          <button
            className="btn ghost"
            onClick={() => {
              const r = Object.fromEntries(PARTS.map((p) => [p.id, pick(p.options).v])) as unknown as PinLook;
              save(r);
            }}
          >
            <Dice5 size={18} /> Aleatório
          </button>
          <button className="btn ghost" onClick={() => save(DEFAULT_LOOK)}>
            <RotateCcw size={18} /> Original
          </button>
        </div>
      </div>
    </Sheet>
  );
}
