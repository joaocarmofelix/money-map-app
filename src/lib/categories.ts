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
export const DEFAULT_INCOME_IDS = new Set(['salario', 'reembolso', 'outros-in', 'subsidios', 'irs', 'sidehustle-in', 'invest-in', 'cartao-refeicao', 'eu-in']);

let o = 0;
const c = (id: string, name: string, icon: string, color: number, extra: Partial<Category> = {}): Category => ({
  id,
  name,
  icon,
  color,
  order: o++,
  ...extra,
});
const sub = (parentId: string, id: string, name: string, icon: string, extra: Partial<Category> = {}) =>
  c(id, name, icon, 0, { parentId, ...extra });
const off = { hidden: true };

/**
 * Starting set, based on João's spreadsheet plus common extras.
 * Ids of earlier versions are kept where the meaning is the same.
 * Less common ones start hidden; turn them on in Categorias.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // Expenses
  c('casa', 'Casa e contas', 'home', 1),
  sub('casa', 'renda', 'Renda ou prestação', 'building'),
  sub('casa', 'luz', 'Eletricidade', 'lightbulb'),
  sub('casa', 'agua', 'Água', 'droplet'),
  sub('casa', 'gas', 'Gás', 'flame'),
  sub('casa', 'net', 'Internet e telemóvel', 'wifi'),
  sub('casa', 'condominio', 'Condomínio', 'building', off),
  sub('casa', 'seguros', 'Seguros', 'shield'),
  sub('casa', 'obras', 'Manutenção e obras', 'hammer'),
  sub('casa', 'mobilia', 'Mobília e decoração', 'sofa'),
  c('super', 'Supermercado', 'cart', 2),
  c('comerfora', 'Comer fora', 'utensils', 3),
  sub('comerfora', 'rest', 'Restaurantes', 'utensils'),
  sub('comerfora', 'delivery', 'Take-away e entregas', 'pizza'),
  sub('comerfora', 'cafe', 'Café e snacks', 'coffee'),
  sub('comerfora', 'bares', 'Bares e copos', 'beer'),
  c('mobilidade', 'Transportes', 'bus', 0),
  sub('mobilidade', 'transp', 'Transportes públicos', 'train'),
  sub('mobilidade', 'combust', 'Combustível', 'fuel'),
  sub('mobilidade', 'portagens', 'Portagens', 'car'),
  sub('mobilidade', 'estacionamento', 'Estacionamento', 'parking'),
  sub('mobilidade', 'tvde', 'Uber e TVDE', 'car'),
  sub('mobilidade', 'carro', 'Manutenção do carro', 'wrench', off),
  sub('mobilidade', 'voos', 'Viagens de avião', 'plane', off),
  c('saude', 'Saúde e farmácia', 'pill', 5),
  sub('saude', 'farmacia', 'Farmácia', 'pill'),
  sub('saude', 'consultas', 'Consultas e exames', 'stethoscope'),
  sub('saude', 'dentista', 'Dentista', 'heart', off),
  sub('saude', 'oculos', 'Óculos e lentes', 'glasses', off),
  c('roupa', 'Roupa e cuidado pessoal', 'shirt', 4),
  sub('roupa', 'vestuario', 'Roupa e calçado', 'shirt'),
  sub('roupa', 'cabeleireiro', 'Cabeleireiro e barbeiro', 'scissors'),
  sub('roupa', 'higiene', 'Higiene e cosmética', 'sparkles'),
  c('lazer', 'Hobbies e diversão', 'gamepad', 6),
  sub('lazer', 'onepiece', 'One Piece TCG', 'cards'),
  sub('lazer', 'jogos', 'Videojogos', 'gamepad'),
  sub('lazer', 'saidas', 'Saídas e noites', 'beer'),
  sub('lazer', 'eventos', 'Cinema, concertos e eventos', 'ticket'),
  sub('lazer', 'livros', 'Livros', 'book'),
  sub('lazer', 'desporto', 'Desporto e ginásio', 'dumbbell'),
  sub('lazer', 'viagens', 'Férias e viagens', 'mountain'),
  c('subscricoes', 'Subscrições e apps', 'tv', 7),
  sub('subscricoes', 'streaming', 'Streaming', 'tv'),
  sub('subscricoes', 'musica', 'Música', 'music'),
  sub('subscricoes', 'software', 'Software e cloud', 'cloud'),
  sub('subscricoes', 'apps', 'Apps e jogos mobile', 'smartphone'),
  c('compras', 'Compras', 'shopping', 4),
  sub('compras', 'tecnologia', 'Tecnologia', 'laptop'),
  sub('compras', 'casa-compras', 'Coisas para casa', 'package'),
  c('sidehustle', 'Side hustle', 'briefcase', 0),
  sub('sidehustle', 'sh-ferramentas', 'Ferramentas e software', 'laptop'),
  sub('sidehustle', 'sh-dominios', 'Domínios e alojamento', 'globe'),
  sub('sidehustle', 'sh-marketing', 'Publicidade', 'megaphone'),
  c('presentes', 'Presentes', 'gift', 5),
  c('pessoas', 'Pessoas', 'handheart', 1),
  sub('pessoas', 'eu', 'Eu (contas que não acompanho)', 'wallet'),
  sub('pessoas', 'familia', 'Família', 'heart'),
  sub('pessoas', 'amigos', 'Amigos e contas divididas', 'handheart'),
  c('taxas', 'Impostos e taxas', 'landmark', 7),
  sub('taxas', 'comissoes', 'Comissões bancárias', 'creditcard'),
  sub('taxas', 'impostos', 'Impostos', 'receipt'),
  c('educacao', 'Educação', 'graduation', 0, off),
  c('animais', 'Animais', 'paw', 2, off),
  c('doacoes', 'Doações', 'heart', 5, off),
  c('outros', 'Outros', 'package', 7),
  // Income
  c('salario', 'Salário líquido', 'briefcase', 5, { income: true }),
  c('subsidios', 'Subsídios', 'gift', 3, { income: true }),
  c('cartao-refeicao', 'Cartão refeição', 'utensils', 2, { income: true, hidden: true }),
  c('reembolso', 'Reembolsos', 'refund', 2, { income: true }),
  c('irs', 'IRS Jovem e reembolso de IRS', 'landmark', 1, { income: true }),
  c('sidehustle-in', 'Side hustles', 'store', 0, { income: true }),
  c('invest-in', 'Rendimentos de investimentos', 'trending', 6, { income: true }),
  c('eu-in', 'De contas minhas que não acompanho', 'wallet', 1, { income: true }),
  c('outros-in', 'Outras entradas', 'coins', 7, { income: true }),
];

/** Old ids that changed meaning, mapped to their new home. */
export const LEGACY_IDS: Record<string, string> = { alimentacao: 'comerfora', contas: 'seguros' };


export interface CatIndex {
  list: Category[];
  byId: Map<string, Category>;
  roots: Category[];
  children: (id: string) => Category[];
  root: (id?: string) => Category | undefined;
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
    isIncome: (id) => !!(id && (byId.get(id)?.income || root(id)?.income)),
    label: (id) => {
      const x = id ? byId.get(id) : undefined;
      if (!x) return 'Por categorizar';
      const p = x.parentId ? byId.get(x.parentId) : undefined;
      return p ? `${p.name} · ${x.name}` : x.name;
    },
  };
}
