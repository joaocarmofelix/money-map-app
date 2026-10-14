import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { db } from '../lib/db';
import { accountName, indexCategories, investName, type CatIndex } from '../lib/categories';
import type { Category, Person, Tx } from '../lib/types';
import type { BudgetState } from '../lib/stats';
import { Icon } from './icons';
import { DEBT_TAGS } from '../lib/tags';
import { fmt, monthLabel, pretty, today } from '../lib/text';

/* ---------- categories context ---------- */
const CatsCtx = createContext<CatIndex | null>(null);
const PeopleCtx = createContext<Map<number, Person>>(new Map());
export function CatsProvider({ children }: { children: ReactNode }) {
  const list = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const cx = useMemo(() => (list ? indexCategories(list) : null), [list]);
  const pm = useMemo(() => new Map((people ?? []).map((p) => [p.id!, p])), [people]);
  if (!cx) return null;
  return (
    <CatsCtx.Provider value={cx}>
      <PeopleCtx.Provider value={pm}>{children}</PeopleCtx.Provider>
    </CatsCtx.Provider>
  );
}
export const useCats = () => useContext(CatsCtx)!;
export const usePeople = () => useContext(PeopleCtx);
export const colorVar = (c?: Category) => (c ? `var(--s${(c.color % 8) + 1})` : 'var(--ink-3)');

/* ---------- small pieces ---------- */
export function CatIcon({ id, size }: { id?: string; size?: 'sm' }) {
  const cx = useCats();
  const c = id ? cx.byId.get(id) : undefined;
  const root = cx.root(id);
  if (!c) return <span className={`cat-ico none${size ? ' sm' : ''}`} aria-hidden />;
  return <IconTile icon={c.icon} color={colorVar(root ?? c)} size={size} />;
}

export function IconTile({ icon, color, size }: { icon: string; color: string; size?: 'sm' }) {
  return (
    <span className={`cat-ico${size ? ' sm' : ''}`} style={{ ['--c' as string]: color }} aria-hidden>
      <Icon name={icon} size={size ? 17 : 19} />
    </span>
  );
}

export function Bar({ value, state, pace }: { value: number; state?: BudgetState; pace?: number }) {
  return (
    <div className={`bar ${state ?? ''}`} role="presentation">
      <span style={{ width: `${Math.min(100, Math.max(value > 0 ? 2 : 0, value * 100))}%` }} />
      {pace !== undefined && pace < 1 && <i className="pace" style={{ left: `${pace * 100}%` }} title="Onde devias estar hoje" />}
    </div>
  );
}

const STATE_TEXT: Record<BudgetState, string> = { ok: 'Dentro do orçamento', warn: 'Atenção', over: 'Ultrapassado' };
export function StatePill({ state, text }: { state: BudgetState; text?: string }) {
  const Ico = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : Flame;
  return (
    <span className={`pill ${state}`}>
      <Ico size={13} strokeWidth={2.5} aria-hidden />
      {text ?? STATE_TEXT[state]}
    </span>
  );
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (delta: number) => void }) {
  const now = today().slice(0, 7);
  const [mName, y] = monthLabel(month).split(' ');
  return (
    <div className="month-pick">
      <button className="icon-btn" onClick={() => onChange(-1)} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <span>
        {mName.slice(0, 3)}. {y}
      </span>
      <button className="icon-btn" onClick={() => onChange(1)} disabled={month >= now} aria-label="Mês seguinte">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function TxRow({ t, onClick }: { t: Tx; onClick: () => void }) {
  const cx = useCats();
  const people = usePeople();
  const person = t.personId ? people.get(t.personId) : undefined;
  const isTr = t.kind === 'transfer';
  const base = person ? person.name : t.source === 'import' ? pretty(t.description) : t.description;
  const title = t.note && t.source === 'import' ? (person ? `${person.name} · ${t.note}` : t.note) : base;
  const sub = isTr
    ? t.cash
      ? 'Levantamento · para Dinheiro'
      : t.invest
      ? `Investimento · ${investName(t.invest)}`
      : t.pot
        ? `Apparte ${t.pot}`
        : 'Entre contas tuas'
    : cx.label(t.categoryId);
  return (
    <button className="tx" onClick={onClick}>
      {isTr ? (
        <IconTile icon={t.cash ? 'banknote' : t.invest ? 'trending' : t.pot ? 'piggy' : 'transfer'} color="var(--ink-2)" />
      ) : (
        <CatIcon id={t.categoryId} />
      )}
      <span className="d">
        <span>{title}</span>
        <small>
          {sub} · {accountName(t.account)}
          {t.source === 'manual' && t.account !== 'cash' ? ' · à espera do extrato' : ''}
        </small>
        {!!t.tags?.length && (
          <span className="tx-tags">
            {t.tags.map((x) => (
              <span key={x} className={`tx-tag${DEBT_TAGS.includes(x) ? ' debt' : ''}`}>
                {x}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={`a num${isTr ? ' tr' : t.amount > 0 ? ' in' : ''}`}>
        {t.amount > 0 ? '+' : ''}
        {fmt(t.amount)}
      </span>
    </button>
  );
}

/* ---------- sheet + toast ---------- */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

let toastSet: ((s: string | null) => void) | null = null;
export const toast = (msg: string) => toastSet?.(msg);
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}
