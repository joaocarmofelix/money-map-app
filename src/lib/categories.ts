import type { Account, Category } from './types';

export const ACCOUNTS: Account[] = [
  { id: 'mil', name: 'Millennium' },
  { id: 'mil-apparte', name: 'Appartes', isSavings: true },
  { id: 'bkt', name: 'Bankinter' },
  { id: 'cash', name: 'Dinheiro' },
];

export const accountName = (id: string) => ACCOUNTS.find((a) => a.id === id)?.name ?? id;

export const CATEGORIES: Category[] = [
  { id: 'super', name: 'Supermercado', emoji: '🛒', food: true },
  { id: 'rest', name: 'Restaurantes', emoji: '🍽️', food: true },
  { id: 'delivery', name: 'Take-away', emoji: '🥡', food: true },
  { id: 'cafe', name: 'Café e snacks', emoji: '☕', food: true },
  { id: 'transp', name: 'Transportes', emoji: '🚇' },
  { id: 'portagens', name: 'Portagens', emoji: '🛣️' },
  { id: 'combust', name: 'Combustível', emoji: '⛽' },
  { id: 'casa', name: 'Casa', emoji: '🏠' },
  { id: 'compras', name: 'Compras', emoji: '🛍️' },
  { id: 'lazer', name: 'Lazer', emoji: '🎮' },
  { id: 'saude', name: 'Saúde', emoji: '💊' },
  { id: 'contas', name: 'Contas e seguros', emoji: '🧾' },
  { id: 'taxas', name: 'Impostos e taxas', emoji: '🏛️' },
  { id: 'pessoas', name: 'Pessoas', emoji: '🤝' },
  { id: 'outros', name: 'Outros', emoji: '📦' },
  { id: 'salario', name: 'Salário', emoji: '💼', income: true },
  { id: 'reembolso', name: 'Reembolsos', emoji: '↩️', income: true },
  { id: 'outros-in', name: 'Outras entradas', emoji: '➕', income: true },
];

export const catById = (id?: string) => CATEGORIES.find((c) => c.id === id);
export const INCOME_IDS = new Set(CATEGORIES.filter((c) => c.income).map((c) => c.id));
export const FOOD_IDS = new Set(CATEGORIES.filter((c) => c.food).map((c) => c.id));
