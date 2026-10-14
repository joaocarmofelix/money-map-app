import type { Tx } from '../lib/types';
import { db } from '../lib/db';
import { accountName } from '../lib/categories';
import { fmt } from '../lib/text';
import { IconTile, Sheet, toast } from './kit';

/** What to do with a transfer to/from yourself that has no matching movement in another tracked account. */
export async function resolveOwn(t: Tx, where: 'tracked' | 'untracked') {
  if (where === 'tracked') await db.txs.update(t.id!, { confirmed: true });
  else await db.txs.update(t.id!, t.amount < 0 ? { kind: 'expense', categoryId: 'eu' } : { kind: 'income', categoryId: 'eu-in' });
}

export function OwnTransferChoices({ t, onDone }: { t: Tx; onDone?: () => void }) {
  const out = t.amount < 0;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        className="btn ghost"
        onClick={async () => {
          await resolveOwn(t, 'tracked');
          toast('Fica como transferência entre contas tuas');
          onDone?.();
        }}
      >
        {out ? 'Foi para' : 'Veio de'} uma conta que acompanho
      </button>
      <button
        className="btn ghost"
        onClick={async () => {
          await resolveOwn(t, 'untracked');
          toast(out ? 'Contado como gasto em Pessoas · Eu' : 'Contado como entrada');
          onDone?.();
        }}
      >
        {out ? 'Foi para outra conta minha (ex.: Caixa)' : 'Veio de outra conta minha (ex.: Caixa)'}
      </button>
    </div>
  );
}

export function OwnTransfersSheet({ list, onClose }: { list: Tx[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="Transferências para ti">
      <div className="stack">
        <div>
          <h3>Transferências para ti sem par</h3>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Não encontrei o outro lado destas transferências nos extratos importados. Se foram para uma conta que a app não acompanha, contam como gasto (em Pessoas · Eu) para o dinheiro não desaparecer das contas.
            Se o outro lado está num extrato que ainda não importaste, deixa ficar como transferência.
          </p>
        </div>
        {list.length === 0 && <p className="muted">Está tudo resolvido.</p>}
        {list.map((t) => (
          <section key={t.id} className="card stack" style={{ gap: 10 }}>
            <div className="cat-row" style={{ padding: 0 }}>
              <IconTile icon="transfer" color="var(--ink-2)" />
              <span>
                <b>{t.description}</b>
                <small>
                  {accountName(t.account)} · {t.date.split('-').reverse().join('/')}
                </small>
              </span>
              <b className="num">{fmt(t.amount)}</b>
            </div>
            <OwnTransferChoices t={t} />
          </section>
        ))}
        <button className="btn" onClick={onClose}>
          Concluir
        </button>
      </div>
    </Sheet>
  );
}
