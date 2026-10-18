import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Flame } from 'lucide-react';
import { db } from '../lib/db';
import type { Goal, Settings, Tx } from '../lib/types';
import { accountList, goalProgress, type GoalProgress } from '../lib/stats';
import { fmt, today } from '../lib/text';
import { Bar, IconTile, Picker, Sheet, toast, useCats } from './kit';
import { IconPicker } from './icons';

const dmy = (d: string) => d.split('-').reverse().join('/');

export function GoalRow({ g, p, onClick }: { g: Goal; p: GoalProgress; onClick: () => void }) {
  return (
    <button className="goal-card" onClick={onClick}>
      <IconTile icon={g.icon} color={p.done ? 'var(--good)' : 'var(--primary)'} />
      <span className="top">
        <b>{g.name}</b>
        <span className="small num muted">{Math.min(999, Math.round(p.pct * 100))}%</span>
      </span>
      <Bar value={p.pct} state={p.done ? "ok" : undefined} />
      <span className="meta num">
        <span>
          {fmt(p.current)} de {fmt(g.target)}
          {g.type === 'monthly' ? ' este mês' : ''}
        </span>
        <span>
          {p.done
            ? g.type === 'monthly'
              ? 'Cumprido este mês'
              : 'Objetivo atingido'
            : p.perMonth
              ? `${fmt(p.perMonth)}/mês até ${dmy(g.deadline!)}`
              : `Faltam ${fmt(p.left)}`}
        </span>
      </span>
      {g.type === 'monthly' && !!p.streak && (
        <span className="meta" style={{ color: 'var(--warn)', fontWeight: 700, justifyContent: 'flex-start', gap: 4 }}>
          <Flame size={14} /> {p.streak} {p.streak === 1 ? 'mês seguido' : 'meses seguidos'} a cumprir
        </span>
      )}
    </button>
  );
}

export function useGoals(txs: Tx[], settings: Settings) {
  const cx = useCats();
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  return useMemo(() => goals.map((g) => ({ g, p: goalProgress(g, txs, settings, cx, today()) })), [goals, txs, settings, cx]);
}

export function GoalsPage({ txs, settings }: { txs: Tx[]; settings: Settings }) {
  const goals = useGoals(txs, settings);
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Objetivos para te motivar: juntar um valor num apparte, chegar a um património, ou pôr de parte um valor todos os meses. Os limites de gastos definem-se nos orçamentos de cada categoria.
      </p>
      {goals.length > 0 && (
        <section className="card" style={{ paddingBlock: 6 }}>
          {goals.map(({ g, p }) => (
            <GoalRow key={g.id} g={g} p={p} onClick={() => setEdit(g)} />
          ))}
        </section>
      )}
      <button className="btn" onClick={() => setEdit('new')}>
        <Plus size={18} /> Novo objetivo
      </button>
      {edit && <GoalEditor goal={edit === 'new' ? undefined : edit} txs={txs} settings={settings} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function GoalEditor({ goal, txs, settings, onClose }: { goal?: Goal; txs: Tx[]; settings: Settings; onClose: () => void }) {
  const accounts = useMemo(() => accountList(txs, settings).filter((a) => !a.key.endsWith('_unassigned')), [txs, settings]);
  const [type, setType] = useState<Goal['type']>(goal?.type ?? 'balance');
  const [account, setAccount] = useState(goal?.account ?? accounts.find((a) => a.group === 'pot')?.key ?? 'networth');
  const [name, setName] = useState(goal?.name ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? 'target');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [confirm, setConfirm] = useState(false);
  const value = parseFloat(target.replace(',', '.'));
  const accName = account === 'networth' ? 'património total' : (accounts.find((a) => a.key === account)?.name ?? '');
  const autoName = type === 'monthly' ? 'Poupar todos os meses' : `Juntar em ${accName}`;

  async function save() {
    if (!(value > 0)) return;
    const g: Goal = {
      ...(goal?.id ? { id: goal.id } : {}),
      name: name.trim() || autoName,
      icon,
      type,
      account: type === 'balance' ? account : undefined,
      target: value,
      deadline: type === 'balance' && deadline ? deadline : undefined,
      createdAt: goal?.createdAt ?? Date.now(),
    };
    await db.goals.put(g);
    toast(goal ? 'Objetivo guardado' : 'Objetivo criado');
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={goal ? 'Editar objetivo' : 'Novo objetivo'}>
      <div className="stack">
        <h3>{goal ? 'Editar objetivo' : 'Novo objetivo'}</h3>
        <div className="seg" role="group" aria-label="Tipo de objetivo">
          <button aria-pressed={type === 'balance'} onClick={() => setType('balance')}>
            Juntar um valor
          </button>
          <button aria-pressed={type === 'monthly'} onClick={() => setType('monthly')}>
            Poupar por mês
          </button>
        </div>
        {type === 'balance' ? (
          <div className="field">
            <label htmlFor="g-acc">Onde</label>
            <Picker id="g-acc" title="Onde" value={account} onChange={setAccount} options={[{ value: 'networth', label: 'Património total' }, ...accounts.map((a) => ({ value: a.key, label: a.name, hint: fmt(a.balance) }))]} />
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Conta o que transferes para os appartes e para investimentos em cada mês.
          </p>
        )}
        <div className="row2">
          <div className="field">
            <label htmlFor="g-target">{type === 'monthly' ? 'Valor por mês' : 'Valor a atingir'}</label>
            <input id="g-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0,00" />
          </div>
          {type === 'balance' && (
            <div className="field">
              <label htmlFor="g-date">Até (opcional)</label>
              <input id="g-date" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="g-name">Nome</label>
          <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName} />
        </div>
        <div className="field">
          <span className="lbl">Ícone</span>
          <IconPicker value={icon} onPick={setIcon} />
        </div>
        <button className="btn" disabled={!(value > 0)} onClick={save}>
          Guardar objetivo
        </button>
        {goal &&
          (confirm ? (
            <button
              className="btn danger"
              onClick={async () => {
                await db.goals.delete(goal.id!);
                toast('Objetivo apagado');
                onClose();
              }}
            >
              Confirmar: apagar objetivo
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirm(true)}>
              Apagar objetivo
            </button>
          ))}
      </div>
    </Sheet>
  );
}
