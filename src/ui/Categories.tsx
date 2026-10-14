import { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { db, deleteCategory } from '../lib/db';
import type { Category } from '../lib/types';
import { fmt } from '../lib/text';
import { CatIcon, Sheet, toast, useCats } from './kit';

const SWATCHES = [0, 1, 2, 3, 4, 5, 6, 7];

export function CategoryEditor({ cat, parentId, income, onClose }: { cat?: Category; parentId?: string; income?: boolean; onClose: () => void }) {
  const cx = useCats();
  const parent0 = cat?.parentId ?? parentId;
  const [name, setName] = useState(cat?.name ?? '');
  const [emoji, setEmoji] = useState(cat?.emoji ?? '🏷️');
  const [color, setColor] = useState(cat?.color ?? (parent0 ? cx.byId.get(parent0)?.color : 0) ?? 0);
  const [parent, setParent] = useState(parent0 ?? '');
  const [food, setFood] = useState(!!cat?.food);
  const [budget, setBudget] = useState(cat?.budget !== undefined ? String(cat.budget) : '');
  const [confirmDel, setConfirmDel] = useState(false);
  const isIncome = cat?.income ?? (parent0 ? cx.byId.get(parent0)?.income : income) ?? false;
  const hasKids = cat ? cx.children(cat.id).length > 0 : false;
  const parents = cx.roots.filter((r) => !!r.income === isIncome && r.id !== cat?.id);

  async function save() {
    const n = name.trim();
    if (!n) return;
    const b = parseFloat(budget.replace(',', '.'));
    const data: Category = {
      id: cat?.id ?? `c${Date.now().toString(36)}`,
      name: n,
      emoji: emoji.trim() || '🏷️',
      color,
      parentId: parent || undefined,
      food: !parent && food ? true : undefined,
      income: isIncome || undefined,
      budget: !isIncome && Number.isFinite(b) && b > 0 ? b : undefined,
      order: cat?.order ?? (Math.max(0, ...cx.list.map((c) => c.order)) + 1),
    };
    await db.categories.put(data);
    toast(cat ? 'Categoria guardada' : 'Categoria criada');
    onClose();
  }

  return (
    <Sheet onClose={onClose} label={cat ? 'Editar categoria' : 'Nova categoria'}>
      <div className="stack">
        <h3>{cat ? 'Editar categoria' : parent0 ? 'Nova subcategoria' : 'Nova categoria'}</h3>
        <div className="row2" style={{ gridTemplateColumns: '72px 1fr' }}>
          <div className="field">
            <label htmlFor="c-emoji">Ícone</label>
            <input id="c-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} style={{ textAlign: 'center', fontSize: 22, padding: 8 }} />
          </div>
          <div className="field">
            <label htmlFor="c-name">Nome</label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: One Piece TCG" autoFocus={!cat} />
          </div>
        </div>
        {!hasKids && (
          <div className="field">
            <label htmlFor="c-parent">Dentro de</label>
            <select id="c-parent" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Nenhuma (categoria principal)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!parent && (
          <div className="field">
            <span className="lbl">Cor</span>
            <div className="swatches" role="group" aria-label="Cor">
              {SWATCHES.map((s) => (
                <button key={s} type="button" aria-label={`Cor ${s + 1}`} aria-pressed={color === s} style={{ background: `var(--s${s + 1})` }} onClick={() => setColor(s)} />
              ))}
            </div>
          </div>
        )}
        {!isIncome && (
          <div className="field">
            <label htmlFor="c-budget">Orçamento mensal</label>
            <input id="c-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Sem limite" />
            <span className="hint">{parent ? 'Conta só para esta subcategoria.' : 'Inclui o que gastares nas subcategorias.'}</span>
          </div>
        )}
        {!parent && !isIncome && (
          <label className="check">
            <input type="checkbox" checked={food} onChange={(e) => setFood(e.target.checked)} />
            <span>É comida (conta para “comida fora do cartão refeição”)</span>
          </label>
        )}
        <button className="btn" onClick={save} disabled={!name.trim()}>
          Guardar
        </button>
        {cat &&
          (confirmDel ? (
            <button
              className="btn danger"
              onClick={async () => {
                await deleteCategory(cat.id);
                toast('Categoria apagada');
                onClose();
              }}
            >
              Confirmar: apagar “{cat.name}”
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmDel(true)}>
              Apagar categoria
            </button>
          ))}
        {confirmDel && (
          <p className="small muted" style={{ margin: 0 }}>
            Os movimentos passam para {cat?.parentId ? 'a categoria principal' : '“por categorizar”'}.
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function CategoriesPage() {
  const cx = useCats();
  const [edit, setEdit] = useState<{ cat?: Category; parentId?: string; income?: boolean } | null>(null);
  const [type, setType] = useState<'out' | 'in'>('out');
  const roots = cx.roots.filter((r) => !!r.income === (type === 'in'));

  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Tipo de categoria">
        <button aria-pressed={type === 'out'} onClick={() => setType('out')}>
          Gastos
        </button>
        <button aria-pressed={type === 'in'} onClick={() => setType('in')}>
          Entradas
        </button>
      </div>
      {roots.map((r) => (
        <section className="card" key={r.id} style={{ paddingBlock: 6 }}>
          <button className="cat-row" onClick={() => setEdit({ cat: r })}>
            <CatIcon id={r.id} />
            <span>
              <b>{r.name}</b>
              <small>
                {r.budget ? `Orçamento ${fmt(r.budget)}/mês` : type === 'out' ? 'Sem orçamento' : 'Entrada'}
                {r.food ? ' · comida' : ''}
              </small>
            </span>
            <ChevronRight size={18} className="muted" aria-hidden />
          </button>
          {cx.children(r.id).map((k) => (
            <button className="cat-row child" key={k.id} onClick={() => setEdit({ cat: k })}>
              <CatIcon id={k.id} size="sm" />
              <span>
                {k.name}
                {k.budget ? <small>Orçamento {fmt(k.budget)}/mês</small> : null}
              </span>
              <ChevronRight size={16} className="muted" aria-hidden />
            </button>
          ))}
          <button className="link" style={{ margin: '4px 0 6px 26px' }} onClick={() => setEdit({ parentId: r.id })}>
            <Plus size={16} /> Subcategoria
          </button>
        </section>
      ))}
      <button className="btn ghost" onClick={() => setEdit({ income: type === 'in' })}>
        <Plus size={18} /> Nova categoria
      </button>
      {edit && <CategoryEditor {...edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
