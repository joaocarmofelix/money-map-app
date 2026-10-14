import { useState } from 'react';
import type { Kind, Tx } from '../lib/types';
import { categorize, db } from '../lib/db';
import { accountName, INVESTMENTS, investName } from '../lib/categories';
import { fmt, pretty, suggestPattern } from '../lib/text';
import { Sheet, toast, useCats } from './kit';
import { CategoryPicker } from './CategoryPicker';

/** Category picker + "remember for similar". Shared by the edit sheet and the triage flow. */
export function CategorizeBlock({ t, onDone }: { t: Tx; onDone: () => void }) {
  const cx = useCats();
  const [pattern, setPattern] = useState(suggestPattern(t.description));
  const [remember, setRemember] = useState(t.source === 'import');

  async function pick(id: string) {
    const n = await categorize(t.id!, id, remember ? pattern : null);
    toast(n > 0 ? `${cx.byId.get(id)?.name}: mais ${n} ${n === 1 ? 'movimento parecido' : 'movimentos parecidos'}` : `Guardado em ${cx.byId.get(id)?.name}`);
    onDone();
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <CategoryPicker value={t.categoryId} onPick={pick} income={t.kind === 'income'} />
      {t.source === 'import' && (
        <div className="card" style={{ padding: 12 }}>
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Usar esta categoria em todos os movimentos com</span>
          </label>
          {remember && (
            <div className="field" style={{ marginTop: 8 }}>
              <input value={pattern} onChange={(e) => setPattern(e.target.value.toUpperCase())} aria-label="Palavra a reconhecer" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EditTx({ t, onClose }: { t: Tx; onClose: () => void }) {
  const [note, setNote] = useState(t.note ?? '');
  const [confirm, setConfirm] = useState(false);

  async function setKind(kind: Kind, invest?: string) {
    await db.txs.update(t.id!, { kind, invest, categoryId: kind === 'transfer' ? undefined : t.categoryId });
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Editar movimento">
      <div className="stack">
        <div>
          <h3>{t.source === 'import' ? pretty(t.description) : t.description}</h3>
          <p className="small muted" style={{ margin: 0 }}>
            <b className="num" style={{ color: 'var(--ink)' }}>
              {fmt(t.amount)}
            </b>{' '}
            · {accountName(t.account)} · {t.date.split('-').reverse().join('/')}
          </p>
          {t.source === 'import' && (
            <p className="small muted" style={{ margin: '4px 0 0', wordBreak: 'break-word' }}>
              {t.description}
            </p>
          )}
        </div>

        {t.kind === 'transfer' ? (
          <>
            <p style={{ margin: 0 }}>
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
              <input id="note" value={note} placeholder="Ex.: jantar de anos" onChange={(e) => setNote(e.target.value)} onBlur={() => db.txs.update(t.id!, { note: note || undefined })} />
            </div>
            <div className="row2">
              <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => setKind('transfer')}>
                Entre contas minhas
              </button>
              {INVESTMENTS.map((i) => (
                <button key={i.id} className="btn ghost sm" style={{ width: '100%' }} onClick={() => setKind('transfer', i.id)}>
                  Para a {i.name}
                </button>
              ))}
            </div>
          </>
        )}
        {t.source === 'manual' &&
          (confirm ? (
            <button
              className="btn danger"
              onClick={async () => {
                await db.txs.delete(t.id!);
                toast('Movimento apagado');
                onClose();
              }}
            >
              Confirmar: apagar
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirm(true)}>
              Apagar movimento
            </button>
          ))}
      </div>
    </Sheet>
  );
}
