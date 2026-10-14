import { useMemo } from 'react';
import type { Settings, Tx } from '../lib/types';
import { accountBalances, monthStats, potBalances } from '../lib/stats';
import { catById, accountName } from '../lib/categories';
import { fmt, monthLabel, shiftMonth } from '../lib/text';

export function Summary({
  txs,
  month,
  settings,
  onTriage,
  onImport,
  onFood,
}: {
  txs: Tx[];
  month: string;
  settings: Settings;
  onTriage: () => void;
  onImport: () => void;
  onFood: () => void;
}) {
  const s = useMemo(() => monthStats(txs, month), [txs, month]);
  const prev = useMemo(() => monthStats(txs, shiftMonth(month, -1)), [txs, month]);
  const pots = useMemo(() => potBalances(txs, settings, `${month}-31`), [txs, settings, month]);
  const balances = useMemo(() => accountBalances(txs), [txs]);
  const allUncat = txs.filter((t) => !t.categoryId && t.kind !== 'transfer').length;

  if (!txs.length) {
    return (
      <div className="empty">
        <h2>Ainda não há movimentos</h2>
        <p>Importa o extrato do Millennium ou o Excel do Bankinter para começar.</p>
        <button className="btn" onClick={onImport}>
          Importar extrato
        </button>
      </div>
    );
  }

  const max = s.byCategory[0]?.total ?? 1;
  const diff = s.food - prev.food;

  return (
    <>
      <section className="ticket" aria-label="Comida paga fora do cartão refeição">
        <p className="lead">Comida paga com o cartão do banco em vez do cartão refeição</p>
        <p className="big num">{fmt(s.food)}</p>
        <div className="perf" />
        <div className="foot">
          {s.food === 0 ? (
            <span className="zero">Nada fora do cartão refeição. É este o objetivo.</span>
          ) : (
            <button
              onClick={onFood}
              style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', textAlign: 'left' }}
            >
              {s.foodTxs.length} {s.foodTxs.length === 1 ? 'compra' : 'compras'} · ver quais
            </button>
          )}
          {txs.some((t) => t.date.startsWith(shiftMonth(month, -1))) ? (
            <span className="num">
              {monthLabel(shiftMonth(month, -1)).split(' ')[0]}: {fmt(prev.food)}
              {prev.food > 0 && ` (${diff <= 0 ? '−' : '+'}${fmt(Math.abs(diff))})`}
            </span>
          ) : null}
        </div>
      </section>

      <dl className="figures">
        <div className="out">
          <dt>Gastaste</dt>
          <dd className="num">{fmt(s.spent)}</dd>
        </div>
        <div className="in">
          <dt>Entrou</dt>
          <dd className="num">{fmt(s.income)}</dd>
        </div>
        <div className="pot">
          <dt>Para appartes</dt>
          <dd className="num">{fmt(s.toPots)}</dd>
        </div>
      </dl>

      {allUncat > 0 && (
        <button className="nudge" onClick={onTriage}>
          <span>
            <strong>{allUncat} movimentos</strong> por categorizar
            <br />
            <span className="muted">Categoriza um e a app trata dos parecidos.</span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      <h2>Para onde foi o dinheiro</h2>
      {s.byCategory.length ? (
        <ul className="bars">
          {s.byCategory.map((b) => {
            const c = catById(b.id);
            return (
              <li key={b.id} className={c?.food ? 'food' : ''}>
                <span>
                  {c ? `${c.emoji} ${c.name}` : 'Por categorizar'} <span className="muted">· {b.count}</span>
                </span>
                <span className="num">{fmt(b.total)}</span>
                <span className="bar">
                  <span style={{ width: `${Math.max(2, (b.total / max) * 100)}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Sem gastos em {monthLabel(month)}.</p>
      )}

      {pots.length > 0 && (
        <>
          <h2>Appartes</h2>
          <div className="pots">
            {pots.map((p) => (
              <div key={p.pot}>
                <span className="muted">{p.pot}</span>
                <b className="num">{fmt(p.balance)}</b>
              </div>
            ))}
          </div>
          {Object.keys(settings.potStart).length === 0 && (
            <p className="muted">Só conta o que entrou desde o primeiro extrato. Define o saldo inicial de cada apparte em Mais.</p>
          )}
        </>
      )}

      {Object.keys(balances).length > 0 && (
        <>
          <h2>Saldos no último extrato</h2>
          <ul className="list-plain">
            {Object.entries(balances).map(([acc, b]) => (
              <li key={acc}>
                <span>
                  {accountName(acc)}{' '}
                  <span className="muted">
                    · {b.date.slice(8)}/{b.date.slice(5, 7)}
                  </span>
                </span>
                <span className="num">{fmt(b.balance)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
