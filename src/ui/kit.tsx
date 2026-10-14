import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Flame, X } from 'lucide-react';
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
  const potTitle = t.pot
    ? t.account === 'mil-apparte'
      ? t.amount > 0
        ? `Entrou no apparte ${t.pot}`
        : `Saiu do apparte ${t.pot}`
      : t.amount > 0
        ? `Tirado do apparte ${t.pot}`
        : `Guardado no apparte ${t.pot}`
    : null;
  const base = potTitle ?? (person ? person.name : t.source === 'import' ? pretty(t.description) : t.description);
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
          {t.statsMonth ? ` · conta em ${monthLabel(t.statsMonth).split(' ')[0]}` : ''}
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
/* Back-button handling shared by sheets and the app's own navigation. */
const sheetStack: { close: () => void; popped: boolean }[] = [];
let ignorePops = 0;
let appBack: (() => void) | null = null;
export const setAppBack = (fn: (() => void) | null) => (appBack = fn);
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const top = sheetStack[sheetStack.length - 1];
    if (top) {
      top.popped = true;
      top.close();
    } else appBack?.();
  });
}

/**
 * Bottom sheet. Drag the top bar down (or tap outside, the X, or Esc) to close.
 * `tall` gives it a fixed height so switching content inside doesn't make it jump.
 */
export function Sheet({
  onClose,
  children,
  label,
  title,
  tall,
  footer,
}: {
  onClose: () => void;
  children: ReactNode;
  label: string;
  title?: string;
  tall?: boolean;
  footer?: ReactNode;
}) {
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  const close = () => {
    if (done.current) return;
    done.current = true;
    setClosing(true);
    setTimeout(onClose, 180);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', k);
    // Android back button closes the sheet instead of leaving the app.
    const entry = { close: () => closeRef.current(), popped: false };
    sheetStack.push(entry);
    history.pushState({ sheet: true }, '');
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      sheetStack.splice(sheetStack.indexOf(entry), 1);
      if (!sheetStack.length) document.body.style.overflow = '';
      if (!entry.popped) {
        ignorePops++;
        history.back();
      }
    };
  }, []);
  return (
    <div className={`scrim${closing ? ' closing' : ''}`} onClick={close}>
      <div
        className={`sheet${tall ? ' tall' : ''}${closing ? ' closing' : ''}${start.current !== null ? ' dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={dy && !closing ? { transform: `translateY(${dy}px)` } : undefined}
      >
        <div
          className="sheet-top"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            start.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDy(Math.max(0, e.clientY - start.current))}
          onPointerUp={() => {
            if (dy > 90) close();
            else setDy(0);
            start.current = null;
          }}
          onPointerCancel={() => {
            start.current = null;
            setDy(0);
          }}
        >
          <div className="grab" aria-hidden />
          <div className="sheet-titlebar">
            {title ? <h3>{title}</h3> : <span />}
            <button className="icon-btn ghost" onClick={close} aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
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
