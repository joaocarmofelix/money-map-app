import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { db, deleteCategory } from '../lib/db';
import type { Category } from '../lib/types';
import { fmt } from '../lib/text';
import { CatIcon, Sheet, toast, useCats } from './kit';
import { IconPicker } from './icons';

const SWATCHES = [0, 1, 2, 3, 4, 5, 6, 7];

export function CategoryEditor({ cat, parentId, income, onClose }: { cat?: Category; parentId?: string; income?: boolean; onClose: () => void }) {
  const cx = useCats();
  const parent0 = cat?.parentId ?? parentId;
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? (parent0 ? cx.byId.get(parent0)?.icon : undefined) ?? 'tag');
  const [color, setColor] = useState(cat?.color ?? (parent0 ? cx.byId.get(parent0)?.color : 0) ?? 0);
  const [parent, setParent] = useState(parent0 ?? '');
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
      icon,
      color,
      parentId: parent || undefined,
      hidden: cat?.hidden,
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
        <div className="field">
          <label htmlFor="c-name">Nome</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: One Piece TCG" autoFocus={!cat} />
        </div>
        <div className="field">
          <span className="lbl">Ícone</span>
          <IconPicker value={icon} onPick={setIcon} />
        </div>
        {!hasKids && (
          <div className="field">
            <label htmlFor="c-parent">Dentro de</label>
            <select id="c-parent" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Nenhuma (categoria principal)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
  const setHidden = (c: Category, hidden: boolean) => db.categories.update(c.id, { hidden: hidden || undefined });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const flip = (id: string) => setExpanded((e) => {
    const n = new Set(e);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Desliga as categorias que não usas: deixam de aparecer quando categorizas, mas continuam a contar nos relatórios.
      </p>
      <div className="seg" role="group" aria-label="Tipo de categoria">
        <button aria-pressed={type === 'out'} onClick={() => setType('out')}>
          Gastos
        </button>
        <button aria-pressed={type === 'in'} onClick={() => setType('in')}>
          Entradas
        </button>
      </div>
      {roots.map((r) => (
        <section className="card" key={r.id} style={{ paddingBlock: 6, opacity: r.hidden ? 0.6 : 1 }}>
          <div className="cat-row">
            <CatIcon id={r.id} />
            <button className="cat-row-main" onClick={() => setEdit({ cat: r })}>
              <b>{r.name}</b>
              <small>{r.budget ? `Orçamento ${fmt(r.budget)}/mês` : type === 'out' ? 'Sem orçamento' : 'Entrada'}</small>
            </button>
            <input type="checkbox" className="toggle" checked={!r.hidden} onChange={(e) => setHidden(r, !e.target.checked)} aria-label={`Mostrar ${r.name}`} />
          </div>
          <div style={{ margin: '-6px 0 4px 52px' }}>
            {cx.children(r.id).length > 0 ? (
              <button className="link small" onClick={() => flip(r.id)} aria-expanded={expanded.has(r.id)}>
                {cx.children(r.id).filter((k) => !k.hidden).length} de {cx.children(r.id).length} subcategorias ativas
                <ChevronDown size={15} style={{ transform: expanded.has(r.id) ? 'rotate(180deg)' : undefined }} />
              </button>
            ) : (
              <button className="link small" onClick={() => setEdit({ parentId: r.id })}>
                <Plus size={15} /> Subcategoria
              </button>
            )}
          </div>
          {expanded.has(r.id) &&
            cx.children(r.id).map((k) => (
              <div className="cat-row child" key={k.id} style={{ opacity: k.hidden ? 0.55 : 1 }}>
                <CatIcon id={k.id} size="sm" />
                <button className="cat-row-main" onClick={() => setEdit({ cat: k })}>
                  {k.name}
                  {k.budget ? <small>Orçamento {fmt(k.budget)}/mês</small> : null}
                </button>
                <input type="checkbox" className="toggle" checked={!k.hidden} onChange={(e) => setHidden(k, !e.target.checked)} aria-label={`Mostrar ${k.name}`} />
              </div>
            ))}
          {expanded.has(r.id) && (
            <button className="link" style={{ margin: '4px 0 6px 26px' }} onClick={() => setEdit({ parentId: r.id })}>
              <Plus size={16} /> Subcategoria
            </button>
          )}
        </section>
      ))}
      <button className="btn ghost" onClick={() => setEdit({ income: type === 'in' })}>
        <Plus size={18} /> Nova categoria
      </button>
      {edit && <CategoryEditor {...edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
