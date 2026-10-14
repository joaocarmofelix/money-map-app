import { useEffect, useState, type ReactNode } from 'react';
import { CATEGORIES, accountName, catById } from '../lib/categories';
import type { Tx } from '../lib/types';
import { fmt, pretty } from '../lib/text';

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

export function CategoryGrid({
  value,
  onPick,
  income,
}: {
  value?: string;
  onPick: (id: string) => void;
  income?: boolean;
}) {
  const list = CATEGORIES.filter((c) => !!c.income === !!income);
  return (
    <div className="cats">
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`cat${c.food ? ' food' : ''}`}
          aria-pressed={value === c.id}
          onClick={() => onPick(c.id)}
        >
          <span className="e" aria-hidden>
            {c.emoji}
          </span>
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function TxRow({ t, onClick, showDate }: { t: Tx; onClick: () => void; showDate?: boolean }) {
  const c = catById(t.categoryId);
  const isTr = t.kind === 'transfer';
  const sub = isTr
    ? t.pot
      ? `Apparte ${t.pot}`
      : 'Transferência entre contas tuas'
    : (c?.name ?? 'Por categorizar');
  return (
    <button className="tx" onClick={onClick}>
      {isTr ? (
        <span className="em" aria-hidden>
          🔁
        </span>
      ) : c ? (
        <span className="em" aria-hidden>
          {c.emoji}
        </span>
      ) : (
        <span className="em none" aria-hidden />
      )}
      <span className="d">
        <span>{t.note && t.source === 'import' ? t.note : t.source === 'import' ? pretty(t.description) : t.description}</span>
        <small>
          {sub} · {accountName(t.account)}
          {showDate ? ` · ${t.date.slice(8)}/${t.date.slice(5, 7)}` : ''}
          {t.source === 'manual' ? ' · à espera do extrato' : ''}
        </small>
      </span>
      <span className={`a num${isTr ? ' tr' : t.amount > 0 ? ' in' : ''}`}>
        {t.amount > 0 ? '+' : ''}
        {fmt(t.amount)}
      </span>
    </button>
  );
}

let toastSet: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSet?.(msg);
}
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setMsg;
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}
