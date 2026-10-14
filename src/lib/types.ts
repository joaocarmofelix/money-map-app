export type Kind = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  name: string;
  /** Saving pots (Millennium "appartes") live inside this account */
  isSavings?: boolean;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  /** Food paid from a bank account instead of the meal card */
  food?: boolean;
  income?: boolean;
}

export interface Tx {
  id?: number;
  /** Stable key used to skip duplicates across imports */
  key: string;
  account: string;
  date: string; // YYYY-MM-DD
  amount: number; // negative = money out
  description: string;
  balance?: number;
  kind: Kind;
  categoryId?: string;
  /** Apparte name for transfers to/from savings pots */
  pot?: string;
  /** Investment account this transfer feeds (e.g. 't212') */
  invest?: string;
  source: 'import' | 'manual';
  note?: string;
  importId?: number;
}

export interface Rule {
  id?: number;
  pattern: string; // normalized substring
  categoryId: string;
  createdAt: number;
}

export interface ImportLog {
  id?: number;
  at: number;
  fileName: string;
  account: string;
  added: number;
  skipped: number;
  merged: number;
  from?: string;
  to?: string;
}

export interface Settings {
  ownerNames: string[];
  /** Apparte balances on trackFrom */
  potStart: Record<string, number>;
  /** Only movements on/after this date are kept (YYYY-MM-DD, '' = everything) */
  trackFrom: string;
  /** Amount already invested before trackFrom, per investment account */
  investStart: Record<string, number>;
}

/** What a parser returns before dedup */
export interface ParsedTx {
  account: string;
  date: string;
  amount: number;
  description: string;
  balance?: number;
}

export interface ParseResult {
  bank: string;
  txs: ParsedTx[];
  warnings: string[];
  /** Last known balance per account, from the statement */
  closing: Record<string, number>;
}
