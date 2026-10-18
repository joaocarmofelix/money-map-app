import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, CircleAlert, CirclePlus } from 'lucide-react';
import type { Reconciliation } from '../lib/importer';
import type { Tx } from '../lib/types';
import { db, mergeManual } from '../lib/db';
import { accountName } from '../lib/categories';
import { fmt, pretty } from '../lib/text';
import { Sheet, toast } from './kit';

const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/** After an import: what you logged by hand next to what the bank shows, per account. */
export function ReconcileSheet({ recon, onClose }: { recon: Reconciliation[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="Comparar com o que apontaste">
      <div className="stack">
        <div>
          <h3>O que apontaste e o que o banco mostra</h3>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Cada gasto do extrato foi juntado a um que apontaste com o mesmo valor, até 4 dias de diferença. Os que sobram estão aqui.
          </p>
        </div>
        {recon.map((r) => (
          <AccountRecon key={r.account} r={r} />
        ))}
        <button className="btn" onClick={onClose}>
          Continuar
        </button>
      </div>
    </Sheet>
  );
}

function AccountRecon({ r }: { r: Reconciliation }) {
  const leftIds = r.leftover.map((t) => t.id!);
  // Live, so entries disappear as you resolve them.
  const left = useLiveQuery(() => db.txs.where('id').anyOf(leftIds).filter((t) => !t.confirmed).toArray(), [leftIds.join()]) ?? r.leftover;
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="card-head" style={{ margin: 0 }}>
        <h2>{accountName(r.account)}</h2>
        <span className="small muted">
          {dm(r.from)} a {dm(r.to)}
        </span>
      </div>
      <dl className="recon">
        <div>
          <dt>Gastos apontados</dt>
          <dd className="num">
            {r.manualCount} · {fmt(r.manualSum)}
          </dd>
        </div>
        <div>
          <dt>Gastos no extrato</dt>
          <dd className="num">
            {r.bankCount} · {fmt(r.bankSum)}
          </dd>
        </div>
        <div>
          <dt>Não apontados</dt>
          <dd className="num">
            {r.missing.count} · {fmt(r.missing.sum)}
          </dd>
        </div>
      </dl>
      <ul className="recon-list">
        <li>
          <CheckCircle2 size={17} style={{ color: 'var(--good)' }} />
          <span>
            <b>{r.matched}</b> juntos, já com a tua categoria
          </span>
        </li>
        <li>
          <CirclePlus size={17} style={{ color: 'var(--primary)' }} />
          <span>
            <b>{r.missing.count}</b> que não tinhas apontado: os que não tiverem regra vais categorizá-los a seguir
          </span>
        </li>
        {left.length > 0 && (
          <li>
            <CircleAlert size={17} style={{ color: 'var(--warn)' }} />
            <span>
              <b>{left.length}</b> {left.length === 1 ? 'apontado sem par no extrato' : 'apontados sem par no extrato'}
            </span>
          </li>
        )}
      </ul>
      {left.map((m) => (
        <Leftover key={m.id} m={m} />
      ))}
    </section>
  );
}

function Leftover({ m }: { m: Tx }) {
  const [joining, setJoining] = useState(false);
  // Bank movements near that date in any account, not yet joined to anything; closest amount first.
  const options =
    useLiveQuery(
      () =>
        joining
          ? db.txs
              .filter((t) => t.source === 'import' && t.kind === m.kind && !t.note && days(t.date, m.date) <= 7)
              .toArray()
              .then((l) => l.sort((a, b) => Math.abs(a.amount - m.amount) - Math.abs(b.amount - m.amount) || days(a.date, m.date) - days(b.date, m.date)).slice(0, 6))
          : Promise.resolve([] as Tx[]),
      [joining, m.id],
    ) ?? [];

  return (
    <div className="leftover">
      <div className="lo-head">
        <span>
          <b>{m.description}</b>
          <small>
            {accountName(m.account)} · {dm(m.date)}
          </small>
        </span>
        <b className="num">{fmt(m.amount)}</b>
      </div>
      {joining ? (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Qual destes movimentos do banco é?</span>
          {options.length === 0 && <span className="small muted">Não há movimentos do banco por juntar perto desta data.</span>}
          {options.map((t) => (
            <button
              key={t.id}
              className="pick"
              onClick={async () => {
                await mergeManual(m.id!, t.id!);
                toast('Juntado ao movimento do banco');
              }}
            >
              <span>
                {pretty(t.description)}
                <small>
                  {accountName(t.account)} · {dm(t.date)}
                </small>
              </span>
              <b className="num">{fmt(t.amount)}</b>
            </button>
          ))}
          <button className="link small" onClick={() => setJoining(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="lo-actions">
          <button className="btn ghost sm" onClick={() => setJoining(true)}>
            Juntar a…
          </button>
          <button
            className="btn ghost sm"
            onClick={async () => {
              await db.txs.delete(m.id!);
              toast('Apagado');
            }}
          >
            Apagar
          </button>
          <button
            className="btn ghost sm"
            onClick={async () => {
              await db.txs.update(m.id!, { confirmed: true });
              toast('Fica como está');
            }}
          >
            Manter
          </button>
        </div>
      )}
    </div>
  );
}
