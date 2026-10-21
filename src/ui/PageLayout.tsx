import { Fragment, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GripVertical, LayoutList } from 'lucide-react';
import { getSettings, updateSettings } from '../lib/db';
import { PAGES, arrange, type PageId } from '../lib/layout';
import { Sheet } from './kit';
import { useSortable } from './useSortable';

const saveOrder = async (page: PageId, order: string[] | undefined) => {
  const fresh = await getSettings();
  const layout = { ...(fresh.layout ?? {}) };
  if (order) layout[page] = order;
  else delete layout[page];
  await updateSettings({ layout });
};

/** Renders a page's sections in the order the user chose. Empty sections can be null. */
export function Arranged({ page, blocks }: { page: PageId; blocks: Record<string, ReactNode> }) {
  const settings = useLiveQuery(getSettings, []);
  return (
    <>
      {arrange(page, settings?.layout?.[page]).map((id) => (
        <Fragment key={id}>{blocks[id]}</Fragment>
      ))}
    </>
  );
}

/** A quiet link at the end of a page that opens the reorder sheet. */
export function OrganizeLink({ page }: { page: PageId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link organize-link" onClick={() => setOpen(true)}>
        <LayoutList size={16} /> Organizar esta página
      </button>
      {open && <OrganizeSheet page={page} onClose={() => setOpen(false)} />}
    </>
  );
}

function OrganizeSheet({ page, onClose }: { page: PageId; onClose: () => void }) {
  const settings = useLiveQuery(getSettings, []);
  const saved = settings?.layout?.[page];
  // Shown straight away after a drop; the saved copy catches up a moment later.
  const [local, setLocal] = useState<string[] | null>(null);
  const order = local ?? arrange(page, saved);
  const labels = new Map<string, string>(PAGES[page].sections.map((s) => [s.id, s.label]));
  const sort = useSortable({ order, axis: 'y', onCommit: (next) => {
      setLocal(next);
      saveOrder(page, next);
    },
  });

  return (
    <Sheet onClose={onClose} label={`Organizar ${PAGES[page].title}`} title={`Organizar · ${PAGES[page].title}`}>
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Arrasta pela pega para mudar a ordem. Algumas secções só aparecem quando têm conteúdo.
        </p>
        <div
          className="order-list"
          role="list"
          ref={sort.containerRef}
          onPointerMove={sort.move}
          onPointerUp={sort.end}
          onPointerCancel={sort.end}
        >
          {order.map((id) => (
            <div className="order-row" role="listitem" key={id} ref={sort.ref(id)}>
              <span className="order-t">{labels.get(id)}</span>
              <span
                className="order-grip"
                aria-label={`Arrastar ${labels.get(id)}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  sort.begin(e, id);
                }}
              >
                <GripVertical size={20} />
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button className="link" disabled={!saved && !local} onClick={() => (setLocal(arrange(page)), saveOrder(page, undefined))}>
            Repor ordem original
          </button>
          <button className="btn sm" style={{ width: 'auto' }} onClick={onClose}>
            Concluído
          </button>
        </div>
      </div>
    </Sheet>
  );
}
