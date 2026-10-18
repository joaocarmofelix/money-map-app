import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { DEBT_TAGS, TAG_OWE, TAG_OWED, TAG_SETTLE, allTags } from '../lib/tags';
import type { Tx } from '../lib/types';
import { Picker, usePeople } from './kit';

const HELP: Record<string, string> = {
  [TAG_OWED]: 'Pagaste por alguém e essa pessoa vai devolver',
  [TAG_OWE]: 'Alguém pagou ou emprestou-te e vais devolver',
  [TAG_SETTLE]: 'Devolução de uma das anteriores',
};

/** Tags and the person a movement is about. Edits are saved as you make them. */
export function TagsBlock({ value, personId, onChange, amount }: { value: string[]; personId?: number; onChange: (tags: string[], personId?: number) => void; amount: number }) {
  const people = usePeople();
  const known = useLiveQuery(() => db.txs.toArray().then(allTags), []) ?? [];
  const [draft, setDraft] = useState('');
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value.filter((x) => !DEBT_TAGS.includes(x) || !DEBT_TAGS.includes(t)), t], personId);
  const free = [...new Set([...known, ...value.filter((t) => !DEBT_TAGS.includes(t))])];
  const debt = value.find((t) => DEBT_TAGS.includes(t));
  // Only offer the debt tags that make sense for the direction of the money.
  const presets = amount < 0 ? [TAG_OWED, TAG_SETTLE] : [TAG_OWE, TAG_SETTLE];

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="lbl small muted" style={{ fontWeight: 600 }}>
        Dívidas entre pessoas
      </span>
      <div className="subcats">
        {presets.map((t) => (
          <button key={t} type="button" aria-pressed={value.includes(t)} onClick={() => toggle(t)} title={HELP[t]}>
            {t}
          </button>
        ))}
      </div>
      {debt && <span className="small muted">{HELP[debt]}. Continua a contar como {amount < 0 ? 'gasto' : 'entrada'}; a etiqueta serve para saberes quem deve o quê.</span>}
      {(debt || personId) && (
        <div className="field">
          <label htmlFor="tx-person">Pessoa</label>
          <Picker id="tx-person" title="Pessoa" value={personId ?? 0} onChange={(v) => onChange(value, v || undefined)} options={[{ value: 0, label: 'Sem pessoa' }, ...[...people.values()].map((p) => ({ value: p.id!, label: p.name }))]} />
          {people.size === 0 && <span className="hint">Cria pessoas em Mais › Pessoas para saberes quem te deve o quê.</span>}
        </div>
      )}
      <span className="lbl small muted" style={{ fontWeight: 600 }}>
        Etiquetas
      </span>
      <div className="subcats">
        {free.map((t) => (
          <button key={t} type="button" aria-pressed={value.includes(t)} onClick={() => toggle(t)}>
            {t}
            {value.includes(t) && <X size={13} />}
          </button>
        ))}
        <form
          className="tag-add"
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim();
            if (t && !value.includes(t)) onChange([...value, t], personId);
            setDraft('');
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nova etiqueta" aria-label="Nova etiqueta" />
          <button type="submit" aria-label="Adicionar etiqueta" disabled={!draft.trim()}>
            <Plus size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

export function TxTagsEditor({ t }: { t: Tx }) {
  const [tags, setTags] = useState(t.tags ?? []);
  const [personId, setPersonId] = useState(t.personId);
  return (
    <TagsBlock
      value={tags}
      personId={personId}
      amount={t.amount}
      onChange={(nt, np) => {
        setTags(nt);
        setPersonId(np);
        db.txs.update(t.id!, { tags: nt.length ? nt : undefined, personId: np });
      }}
    />
  );
}
