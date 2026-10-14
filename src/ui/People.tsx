import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus } from 'lucide-react';
import { db, getSettings, linkPerson } from '../lib/db';
import { personFor } from '../lib/classify';
import type { Person, Tx } from '../lib/types';
import { fmt, norm } from '../lib/text';
import { IconTile, Sheet, toast } from './kit';

const REL: Record<Person['relation'], string> = { familia: 'Família', amigos: 'Amigo', outro: 'Outro' };
const dmy = (d: string) => d.split('-').reverse().join('/');

/** Names that appear in transfers and MB WAY payments, e.g. "TRF MB WAY P/ MARIA EDUARDA X CS" → "MARIA EDUARDA X". */
export function nameInTransfer(desc: string): string | null {
  const d = norm(desc);
  const m = d.match(/^(?:TRF\.? MB ?WAY P\/O?|TRF\.? P\/O?|TRF IMEDIATA P\/|TRANSF IMED DE|TRF DE)\s+(.+)$/);
  if (!m) return null;
  const name = m[1].split(' - ')[0].replace(/\s+CS$/, '').trim();
  if (/MILLENNIUMBCP|TRANSFERENCIA|TRADING|PERMANENTE|^\d/.test(name) || name.split(' ').length < 2) return null;
  return name;
}

export function PeoplePage({ txs }: { txs: Tx[] }) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const owner = useLiveQuery(getSettings, [])?.ownerNames ?? [];
  const [edit, setEdit] = useState<Partial<Person> | null>(null);
  const [open, setOpen] = useState<Person | null>(null);

  const totals = useMemo(() => {
    const m = new Map<number, { out: number; in: number; n: number }>();
    for (const t of txs) {
      if (!t.personId) continue;
      const e = m.get(t.personId) ?? { out: 0, in: 0, n: 0 };
      if (t.amount < 0) e.out += -t.amount;
      else e.in += t.amount;
      e.n++;
      m.set(t.personId, e);
    }
    return m;
  }, [txs]);

  // Names seen in transfers that aren't saved yet (and aren't you).
  const suggestions = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of txs) {
      if (t.personId || t.kind === 'transfer') continue;
      const n = nameInTransfer(t.description);
      if (!n || owner.some((o) => norm(o) === n) || personFor(n, people)) continue;
      c.set(n, (c.get(n) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [txs, people, owner]);

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Guarda as pessoas a quem envias ou de quem recebes dinheiro. As transferências e os MB WAY ficam ligados a elas e podes escrever o motivo de cada um.
      </p>
      {people.length > 0 && (
        <section className="card" style={{ paddingBlock: 4 }}>
          {people.map((p) => {
            const t = totals.get(p.id!);
            return (
              <button key={p.id} className="cat-row" onClick={() => setOpen(p)}>
                <IconTile icon={p.relation === 'familia' ? 'heart' : 'handheart'} color={p.relation === 'familia' ? 'var(--s5)' : 'var(--s1)'} />
                <span>
                  <b>{p.name}</b>
                  <small className="num">
                    {REL[p.relation]} · {t ? `enviado ${fmt(t.out)} · recebido ${fmt(t.in)}` : 'sem movimentos'}
                  </small>
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
            );
          })}
        </section>
      )}
      {suggestions.length > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <b>Encontrados nas tuas transferências</b>
          <div className="subcats">
            {suggestions.map(([n, c]) => (
              <button key={n} onClick={() => setEdit({ match: n, name: n.split(' ').slice(0, 2).map((w) => w[0] + w.slice(1).toLowerCase()).join(' '), relation: 'familia' })}>
                <Plus size={14} /> {n} <span className="muted">· {c}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <button className="btn" onClick={() => setEdit({ relation: 'familia' })}>
        <Plus size={18} /> Nova pessoa
      </button>
      {edit && <PersonEditor initial={edit} onClose={() => setEdit(null)} />}
      {open && <PersonSheet person={open} txs={txs} onClose={() => setOpen(null)} onEdit={() => (setEdit(open), setOpen(null))} />}
    </div>
  );
}

export function PersonEditor({ initial, onClose }: { initial: Partial<Person>; onClose: () => void }) {
  const [name, setName] = useState(initial.name ?? '');
  const [match, setMatch] = useState(initial.match ?? '');
  const [relation, setRelation] = useState<Person['relation']>(initial.relation ?? 'familia');
  const [confirm, setConfirm] = useState(false);
  const ok = name.trim() && match.trim().length > 2;

  async function save() {
    const p: Person = { ...(initial.id ? { id: initial.id } : {}), name: name.trim(), match: norm(match), relation };
    p.id = await db.people.put(p);
    await linkPerson(p);
    const n = await db.txs.where('personId').equals(p.id).count();
    toast(`${p.name}: ${n} ${n === 1 ? 'movimento ligado' : 'movimentos ligados'}`);
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={initial.id ? 'Editar pessoa' : 'Nova pessoa'}>
      <div className="stack">
        <h3>{initial.id ? 'Editar pessoa' : 'Nova pessoa'}</h3>
        <div className="field">
          <label htmlFor="p-name">Nome a mostrar</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria (irmã)" />
        </div>
        <div className="field">
          <label htmlFor="p-match">Nome como aparece no banco</label>
          <input id="p-match" value={match} onChange={(e) => setMatch(e.target.value.toUpperCase())} placeholder="Ex.: MARIA EDUARDA" />
          <span className="hint">Basta uma parte do nome que só esta pessoa tenha, por exemplo os dois primeiros nomes.</span>
        </div>
        <div className="seg" role="group" aria-label="Relação">
          {(Object.keys(REL) as Person['relation'][]).map((r) => (
            <button key={r} aria-pressed={relation === r} onClick={() => setRelation(r)}>
              {REL[r]}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          O que enviares vai para Pessoas · {relation === 'familia' ? 'Família' : relation === 'amigos' ? 'Amigos' : 'Geral'}; o que receberes vai para Recebido de pessoas. Movimentos que já tinham categoria ficam como estão.
        </p>
        <button className="btn" disabled={!ok} onClick={save}>
          Guardar
        </button>
        {initial.id &&
          (confirm ? (
            <button
              className="btn danger"
              onClick={async () => {
                await db.txs.where('personId').equals(initial.id!).modify({ personId: undefined });
                await db.people.delete(initial.id!);
                toast('Pessoa apagada');
                onClose();
              }}
            >
              Confirmar: apagar pessoa
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirm(true)}>
              Apagar pessoa
            </button>
          ))}
      </div>
    </Sheet>
  );
}

function PersonSheet({ person, txs, onClose, onEdit }: { person: Person; txs: Tx[]; onClose: () => void; onEdit: () => void }) {
  const list = txs.filter((t) => t.personId === person.id).sort((a, b) => b.date.localeCompare(a.date));
  const out = list.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);
  const inn = list.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  return (
    <Sheet onClose={onClose} label={person.name}>
      <div className="stack">
        <div className="sheet-head">
          <IconTile icon={person.relation === 'familia' ? 'heart' : 'handheart'} color={person.relation === 'familia' ? 'var(--s5)' : 'var(--s1)'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{person.name}</h3>
            <span className="small muted">
              {REL[person.relation]} · no banco: {person.match}
            </span>
          </div>
          <button className="link" onClick={onEdit}>
            Editar
          </button>
        </div>
        <dl className="glance" style={{ margin: 0 }}>
          <div>
            <dt>Enviaste</dt>
            <dd className="num">{fmt(out)}</dd>
          </div>
          <div>
            <dt>Recebeste</dt>
            <dd className="num" style={{ color: 'var(--good)' }}>
              {fmt(inn)}
            </dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd className="num">{fmt(inn - out)}</dd>
          </div>
        </dl>
        <p className="small muted" style={{ margin: 0 }}>
          Escreve o motivo de cada movimento; fica guardado e aparece na lista de movimentos.
        </p>
        <section className="card" style={{ paddingBlock: 4 }}>
          {list.length === 0 && <p className="muted">Ainda não há movimentos com esta pessoa.</p>}
          {list.map((t) => (
            <div key={t.id} className="reason-row">
              <div className="lo-head">
                <span>
                  <b>{dmy(t.date)}</b>
                  <small>{t.description}</small>
                </span>
                <b className="num" style={{ color: t.amount > 0 ? 'var(--good)' : undefined }}>
                  {t.amount > 0 ? '+' : ''}
                  {fmt(t.amount)}
                </b>
              </div>
              <input
                className="reason"
                defaultValue={t.note ?? ''}
                placeholder="Motivo (ex.: metade do jantar)"
                aria-label={`Motivo do movimento de ${dmy(t.date)}`}
                onBlur={(e) => db.txs.update(t.id!, { note: e.target.value.trim() || undefined })}
              />
            </div>
          ))}
        </section>
      </div>
    </Sheet>
  );
}
