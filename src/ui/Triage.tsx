import { useMemo, useState } from 'react';
import { needsCategory } from '../lib/tags';
import { ArrowLeft, Check, CheckCircle2 } from 'lucide-react';
import type { Tx } from '../lib/types';
import { accountName } from '../lib/categories';
import { categorize, getSettings } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Mascot } from './Companion';
import { fmt, pretty } from '../lib/text';
import { buildSuggester, triageOrder } from '../lib/suggest';
import { Sheet, toast, useCats } from './kit';
import { CategorizeBlock } from './EditTx';

const short = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

/**
 * Every movement still waiting for a category, newest first. Pick the ones you recognise;
 * a suggestion from your history can be accepted straight from the list.
 */
export function Triage({ txs, intro, onClose }: { txs: Tx[]; intro?: string; onClose: () => void }) {
  const cx = useCats();
  const open = useMemo(() => txs.filter(needsCategory).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)), [txs]);
  const suggest = useMemo(() => buildSuggester(txs), [txs]);
  const similar = useMemo(() => new Map(triageOrder(open).map((x) => [x.tx.id, x.similar])), [open]);
  const [selId, setSelId] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const sel = open.find((t) => t.id === selId);
  const pinSettings = useLiveQuery(getSettings, []);
  const companionOn = !!pinSettings && pinSettings.companion !== false;

  async function accept(t: Tx, categoryId: string) {
    await categorize(t.id!, categoryId, null);
    setDone((n) => n + 1);
    toast(`Guardado em ${cx.byId.get(categoryId)?.name}`);
  }

  if (sel) {
    return (
      <Sheet onClose={onClose} label="Categorizar movimento" tall>
        <div className="triage stack">
          <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setSelId(null)}>
            <ArrowLeft size={16} /> Voltar à lista ({open.length})
          </button>
          <div>
            <p className="desc">{pretty(sel.description)}</p>
            <p className="small muted" style={{ margin: '2px 0 0', wordBreak: 'break-word' }}>
              {accountName(sel.account)} · {sel.date.split('-').reverse().join('/')} · {sel.description}
            </p>
            <p className="amt num" style={{ margin: '6px 0 0' }}>
              {fmt(sel.amount)}
            </p>
          </div>
          <CategorizeBlock
            key={sel.id}
            t={sel}
            onDone={() => {
              setDone((n) => n + 1);
              setSelId(null);
            }}
            suggestion={suggest(sel)}
            similar={similar.get(sel.id) ?? 0}
          />
        </div>
      </Sheet>
    );
  }

  if (!open.length) {
    return (
      <Sheet onClose={onClose} label="Categorizar movimentos" tall>
        <div className="done-state stack">
          {companionOn ? (
            <Mascot size={72} look={pinSettings?.pin} />
          ) : (
            <div className="qi">
              <CheckCircle2 size={28} />
            </div>
          )}
          <h3>Está tudo categorizado</h3>
          <p className="muted" style={{ margin: 0 }}>
            {done > 0 ? `Categorizaste ${done} ${done === 1 ? 'movimento' : 'movimentos'}.` : 'Não há nada por categorizar.'}
          </p>
          <button className="btn" onClick={onClose}>
            Concluir
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} label="Movimentos por categorizar" title={`Por categorizar (${open.length})`} tall>
      <div className="stack" style={{ gap: 10 }}>
        {intro && done === 0 && <div className="intro">{intro}</div>}
        <p className="small muted" style={{ margin: 0 }}>
          Toca num movimento para escolher a categoria, ou aceita a sugestão quando aparece. Os que não sabes ficam aqui para depois.
        </p>
        <div className="uc-list">
          {open.map((t) => {
            const sg = suggest(t);
            const sgCat = sg ? cx.byId.get(sg.categoryId) : undefined;
            return (
              <div className="uc" key={t.id}>
                <button className="uc-main" onClick={() => setSelId(t.id!)}>
                  <span className="uc-t">{pretty(t.description)}</span>
                  <span className="uc-a num" style={t.amount > 0 ? { color: 'var(--good)' } : undefined}>
                    {fmt(t.amount)}
                  </span>
                  <span className="uc-s">
                    {short(t.date)} · {accountName(t.account)}
                    {(similar.get(t.id) ?? 0) > 0 ? ` · +${similar.get(t.id)} parecidos` : ''}
                  </span>
                </button>
                {sg && sgCat && (
                  <div className="uc-actions">
                    <button className="uc-chip" onClick={() => accept(t, sg.categoryId)} aria-label={`Aceitar ${cx.label(sg.categoryId)}`}>
                      <Check size={14} /> {sgCat.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
