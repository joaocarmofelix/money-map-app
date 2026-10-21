import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { CatGrid } from './CatGrid';
import { db } from '../lib/db';
import { norm } from '../lib/text';
import { CatIcon, useCats } from './kit';
import { Icon } from './icons';

/**
 * Two-level picker. Tap a group; if it has subcategories, choose one (or "Geral").
 * The search box finds any category, including hidden ones, and creates a new one when nothing fits.
 */
export function CategoryPicker({ value, onPick, income }: { value?: string; onPick: (id: string) => void; income?: boolean }) {
  const cx = useCats();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | undefined>(() => {
    const r = cx.root(value);
    return r && cx.children(r.id).some((k) => !k.hidden) ? r.id : undefined;
  });
  const sameType = (id?: string) => !!cx.isIncome(id) === !!income;
  const roots = cx.roots.filter((c) => sameType(c.id) && !c.hidden);
  const openRoot = open ? cx.byId.get(open) : undefined;
  const kids = open ? cx.children(open).filter((k) => !k.hidden) : [];

  const query = norm(q);
  const matches = query
    ? cx.list.filter((c) => sameType(c.id) && (norm(c.name).includes(query) || norm(cx.label(c.id)).includes(query))).slice(0, 8)
    : [];
  const exact = matches.some((c) => norm(c.name) === query);

  async function choose(id: string) {
    const c = cx.byId.get(id);
    if (c?.hidden) await db.categories.update(id, { hidden: false });
    if (c?.parentId && cx.byId.get(c.parentId)?.hidden) await db.categories.update(c.parentId, { hidden: false });
    setQ('');
    onPick(id);
  }

  async function create(parentId?: string) {
    const name = q.trim().replace(/^./, (m) => m.toUpperCase());
    const parent = parentId ? cx.byId.get(parentId) : undefined;
    const id = `c${Date.now().toString(36)}`;
    await db.categories.add({
      id,
      name,
      icon: parent?.icon ?? 'tag',
      color: parent?.color ?? cx.roots.length % 8,
      parentId,
      income: income || undefined,
      order: Math.max(0, ...cx.list.map((c) => c.order)) + 1,
    });
    setQ('');
    onPick(id);
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="cat-search">
        <Search size={17} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar ou criar categoria" aria-label="Procurar ou criar categoria" />
      </label>

      {query ? (
        <div className="results">
          {matches.map((c) => (
            <button key={c.id} type="button" onClick={() => choose(c.id)}>
              <CatIcon id={c.id} size="sm" />
              <span>
                {c.name}
                <small>
                  {c.parentId ? cx.byId.get(c.parentId)?.name : 'Categoria principal'}
                  {c.hidden ? ' · desativada, vai ser ativada' : ''}
                </small>
              </span>
            </button>
          ))}
          {!exact && q.trim().length > 1 && (
            <>
              {openRoot && sameType(openRoot.id) && (
                <button type="button" className="create" onClick={() => create(openRoot.id)}>
                  <span className="cat-ico sm" style={{ ['--c' as string]: 'var(--primary)' }}>
                    <Plus size={17} />
                  </span>
                  <span>
                    Criar “{q.trim()}”<small>dentro de {openRoot.name}</small>
                  </span>
                </button>
              )}
              <button type="button" className="create" onClick={() => create()}>
                <span className="cat-ico sm" style={{ ['--c' as string]: 'var(--primary)' }}>
                  <Plus size={17} />
                </span>
                <span>
                  Criar “{q.trim()}”<small>como categoria principal</small>
                </span>
              </button>
            </>
          )}
          {matches.length === 0 && q.trim().length <= 1 && <p className="small muted">Escreve pelo menos duas letras.</p>}
        </div>
      ) : (
        <>
          <CatGrid
            items={roots}
            open={openRoot?.id}
            pressed={(c) => value === c.id || cx.root(value)?.id === c.id}
            onTile={(c) => (cx.children(c.id).some((k) => !k.hidden) ? setOpen(open === c.id ? undefined : c.id) : choose(c.id))}
            panel={
              openRoot && (
                <div className="subcats">
                  <button type="button" aria-pressed={value === openRoot.id} onClick={() => choose(openRoot.id)}>
                    Geral
                  </button>
                  {kids.map((k) => (
                    <button key={k.id} type="button" aria-pressed={value === k.id} onClick={() => choose(k.id)}>
                      <Icon name={k.icon} size={15} />
                      {k.name}
                    </button>
                  ))}
                </div>
              )
            }
          />
        </>
      )}
    </div>
  );
}
