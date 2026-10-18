import { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Tx } from '../lib/types';
import { monthStats } from '../lib/stats';
import { fmt, monthLabel, shiftMonth, today } from '../lib/text';
import { useCats } from './kit';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The month at a glance: spending so far against last month at the same day, money in, money saved. */
export function MonthCard({ txs, month }: { txs: Tx[]; month: string }) {
  const cx = useCats();
  const s = useMemo(() => monthStats(txs, month, cx), [txs, month, cx]);
  // Spending pace: this month so far against the previous month up to the same day.
  const isNow = month === today().slice(0, 7);
  const pace = useMemo(() => {
    const prev = shiftMonth(month, -1);
    const day = today().slice(8);
    const cut = isNow ? `${prev}-${day}` : `${prev}-31`;
    const before = monthStats(
      txs.filter((t) => t.date <= cut),
      prev,
      cx,
    ).spent;
    if (before <= 0) return null;
    const diff = s.spent - before;
    const name = monthLabel(prev).split(' ')[0];
    return { diff, pct: diff / before, label: isNow ? `em ${name} até ao dia ${Number(day)}` : `em ${name}` };
  }, [txs, month, cx, s.spent, isNow]);

  return (
        <section className="card">
          <div className="card-head">
            <h2>{isNow ? 'Este mês' : cap(monthLabel(month))}</h2>
          </div>
          <div className="pace">
            <div>
              <div className="small muted">{isNow ? 'Gastaste até hoje' : 'Gastaste'}</div>
              <div className="big num">{fmt(s.spent)}</div>
            </div>
            {pace && (
              <span className={`pace-pill ${pace.diff > 0 ? 'up' : 'down'}`} title={pace.label}>
                {pace.diff > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                <span className="num">{Math.abs(Math.round(pace.pct * 100))}%</span>
              </span>
            )}
          </div>
          {pace && (
            <p className="small muted" style={{ margin: '2px 0 12px' }}>
              {pace.diff > 0 ? 'Mais' : 'Menos'} <b className="num">{fmt(Math.abs(pace.diff))}</b> do que {pace.label}.
            </p>
          )}
          <dl className="glance two" style={{ margin: '12px 0 0' }}>
            <div>
              <dt>Entrou</dt>
              <dd className="num" style={{ color: 'var(--good)' }}>
                {fmt(s.income)}
              </dd>
            </div>
            <div>
              <dt>Poupaste</dt>
              <dd className="num">{fmt(s.toPots + s.toInvest)}</dd>
            </div>
          </dl>
          {s.extra > 0 && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Mais <b className="num">{fmt(s.extra)}</b> em despesas extraordinárias ({s.extraByRoot.map((x) => cx.byId.get(x.id)?.name).join(', ')}).
            </p>
          )}
        </section>
  );
}
