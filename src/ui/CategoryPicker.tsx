import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CatIcon, useCats } from './kit';

/** Two-level picker: tap a group; if it has subcategories, choose one (or the group itself). */
export function CategoryPicker({ value, onPick, income }: { value?: string; onPick: (id: string) => void; income?: boolean }) {
  const cx = useCats();
  const [open, setOpen] = useState<string | undefined>(() => {
    const r = cx.root(value);
    return r && cx.children(r.id).length ? r.id : undefined;
  });
  const roots = cx.roots.filter((c) => !!c.income === !!income);
  const openRoot = open ? cx.byId.get(open) : undefined;
  const kids = open ? cx.children(open) : [];

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="cats">
        {roots.map((c) => {
          const has = cx.children(c.id).length > 0;
          const selected = value === c.id || cx.root(value)?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className="cat"
              aria-pressed={selected}
              aria-expanded={has ? open === c.id : undefined}
              onClick={() => (has ? setOpen(open === c.id ? undefined : c.id) : onPick(c.id))}
            >
              <CatIcon id={c.id} />
              {c.name}
              {has && <ChevronDown size={14} className="more" aria-hidden />}
            </button>
          );
        })}
      </div>
      {openRoot && (
        <div>
          <p className="small muted" style={{ margin: '0 0 6px' }}>
            {openRoot.name}
          </p>
          <div className="subcats">
            <button type="button" aria-pressed={value === openRoot.id} onClick={() => onPick(openRoot.id)}>
              Geral
            </button>
            {kids.map((k) => (
              <button key={k.id} type="button" aria-pressed={value === k.id} onClick={() => onPick(k.id)}>
                <span aria-hidden>{k.emoji}</span>
                {k.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
