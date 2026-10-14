import type { Account, Category } from './types';

export const ACCOUNTS: Account[] = [
  { id: 'mil', name: 'Millennium' },
  { id: 'mil-apparte', name: 'Appartes', isSavings: true },
  { id: 'bkt', name: 'Bankinter' },
  { id: 'cash', name: 'Dinheiro' },
];
export const accountName = (id: string) => ACCOUNTS.find((a) => a.id === id)?.name ?? id;

export const INVESTMENTS = [{ id: 't212', name: 'Trading 212', match: /TRADING ?212/i }];
export const investName = (id: string) => INVESTMENTS.find((i) => i.id === id)?.name ?? id;

/** Ids of the default income categories, for rules saved before rules carried their own flag. */
export const DEFAULT_INCOME_IDS = new Set(['salario', 'reembolso', 'outros-in']);

let o = 0;
const c = (id: string, name: string, emoji: string, color: number, extra: Partial<Category> = {}): Category => ({
  id,
  name,
  emoji,
  color,
  order: o++,
  ...extra,
});

/** Starting set. Ids match earlier versions so existing movements keep their category. */
export const DEFAULT_CATEGORIES: Category[] = [
  c('alimentacao', 'Alimentação', '🍽️', 3, { food: true }),
  c('super', 'Supermercado', '🛒', 3, { parentId: 'alimentacao' }),
  c('rest', 'Restaurantes', '🍝', 3, { parentId: 'alimentacao' }),
  c('delivery', 'Take-away', '🥡', 3, { parentId: 'alimentacao' }),
  c('cafe', 'Café e snacks', '☕', 3, { parentId: 'alimentacao' }),
  c('mobilidade', 'Mobilidade', '🚗', 0),
  c('transp', 'Transportes públicos', '🚇', 0, { parentId: 'mobilidade' }),
  c('portagens', 'Portagens', '🛣️', 0, { parentId: 'mobilidade' }),
  c('combust', 'Combustível', '⛽', 0, { parentId: 'mobilidade' }),
  c('lazer', 'Entretenimento', '🎮', 6),
  c('onepiece', 'One Piece TCG', '🃏', 6, { parentId: 'lazer' }),
  c('jogos', 'Videojogos', '🕹️', 6, { parentId: 'lazer' }),
  c('saidas', 'Saídas', '🍻', 6, { parentId: 'lazer' }),
  c('compras', 'Compras', '🛍️', 4),
  c('casa', 'Casa', '🏠', 2),
  c('contas', 'Contas e seguros', '🧾', 1),
  c('saude', 'Saúde', '💊', 5),
  c('taxas', 'Impostos e taxas', '🏛️', 7),
  c('pessoas', 'Pessoas', '🤝', 1),
  c('outros', 'Outros', '📦', 7),
  c('salario', 'Salário', '💼', 5, { income: true }),
  c('reembolso', 'Reembolsos', '↩️', 2, { income: true }),
  c('outros-in', 'Outras entradas', '➕', 0, { income: true }),
];

/** Old flat ids that became subcategories need no mapping; "lazer" keeps its id as Entretenimento. */

export interface CatIndex {
  list: Category[];
  byId: Map<string, Category>;
  roots: Category[];
  children: (id: string) => Category[];
  root: (id?: string) => Category | undefined;
  isFood: (id?: string) => boolean;
  isIncome: (id?: string) => boolean;
  label: (id?: string) => string;
}

export function indexCategories(list: Category[]): CatIndex {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  const byId = new Map(sorted.map((x) => [x.id, x]));
  const root = (id?: string) => {
    let cur = id ? byId.get(id) : undefined;
    while (cur?.parentId && byId.get(cur.parentId)) cur = byId.get(cur.parentId);
    return cur;
  };
  return {
    list: sorted,
    byId,
    roots: sorted.filter((x) => !x.parentId || !byId.has(x.parentId)),
    children: (id) => sorted.filter((x) => x.parentId === id),
    root,
    isFood: (id) => !!(id && (byId.get(id)?.food || root(id)?.food)),
    isIncome: (id) => !!(id && (byId.get(id)?.income || root(id)?.income)),
    label: (id) => {
      const x = id ? byId.get(id) : undefined;
      if (!x) return 'Por categorizar';
      const p = x.parentId ? byId.get(x.parentId) : undefined;
      return p ? `${p.name} · ${x.name}` : x.name;
    },
  };
}
