import { useState } from 'react';
import type { Kind, Tx } from '../lib/types';
import { Sheet, CategoryGrid, toast } from './shared';
import { categorize, db } from '../lib/db';
import { accountName, INVESTMENTS, investName } from '../lib/categories';
import { fmt, suggestPattern } from '../lib/text';

/** Category picker + "remember for similar" — shared by the edit sheet and triage. */
export function CategorizeBlock({ t, onDone }: { t: Tx; onDone: () => void }) {
  const [pattern, setPattern] = useState(suggestPattern(t.description));
  const [remember, setRemember] = useState(t.source === 'import');

  async function pick(id: string) {
    const n = await categorize(t.id!, id, remember ? pattern : null);
    if (n > 0) toast(`Mais ${n} ${n === 1 ? 'movimento parecido categorizado' : 'movimentos parecidos categorizados'}`);
    onDone();
  }

  return (
    <>
      <CategoryGrid value={t.categoryId} onPick={pick} income={t.kind === 'income'} />
      {t.source === 'import' && (
        <>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Usar a mesma categoria em movimentos com esta palavra</span>
          </label>
          {remember && (
            <div className="field" style={{ marginTop: 0 }}>
              <input value={pattern} onChange={(e) => setPattern(e.target.value.toUpperCase())} aria-label="Palavra a reconhecer" />
            </div>
          )}
        </>
      )}
    </>
  );
}

export function EditTx({ t, onClose }: { t: Tx; onClose: () => void }) {
  const [note, setNote] = useState(t.note ?? '');

  async function setKind(kind: Kind, invest?: string) {
    await db.txs.update(t.id!, { kind, invest, categoryId: kind === 'transfer' ? undefined : t.categoryId });
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Editar movimento">
      <h3>{t.description}</h3>
      <p className="muted">
        {fmt(t.amount)} · {accountName(t.account)} · {t.date.split('-').reverse().join('/')}
      </p>

      {t.kind === 'transfer' ? (
        <>
          <p>
            {t.invest
              ? `Dinheiro para investir na ${investName(t.invest)}. Não conta como gasto.`
              : t.pot
              ? `Movimento do apparte ${t.pot}. Não conta como gasto.`
              : 'Transferência entre contas tuas. Não conta como gasto.'}
          </p>
          <button className="btn ghost" onClick={() => setKind(t.amount < 0 ? 'expense' : 'income')}>
            Não é transferência, contar como {t.amount < 0 ? 'gasto' : 'entrada'}
          </button>
        </>
      ) : (
        <>
          <CategorizeBlock t={t} onDone={onClose} />
          <div className="field">
            <label htmlFor="note">Nota</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => db.txs.update(t.id!, { note: note || undefined })} />
          </div>
          <button className="btn ghost" onClick={() => setKind('transfer')}>
            É uma transferência entre contas minhas
          </button>
          {INVESTMENTS.map((i) => (
            <button key={i.id} className="btn ghost" onClick={() => setKind('transfer', i.id)}>
              É dinheiro para a {i.name}
            </button>
          ))}
        </>
      )}
      {t.source === 'manual' && (
        <button
          className="btn danger"
          onClick={async () => {
            await db.txs.delete(t.id!);
            toast('Gasto apagado');
            onClose();
          }}
        >
          Apagar gasto
        </button>
      )}
    </Sheet>
  );
}
