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
  /** Key into the icon set (see ui/icons.tsx) */
  icon: string;
  /** Index into the chart palette (0-7) */
  color: number;
  /** Set for subcategories (e.g. One Piece TCG under Entretenimento) */
  parentId?: string;
  income?: boolean;
  /** Hidden from the picker when categorizing (still counts in reports) */
  hidden?: boolean;
  /** Monthly spending limit in euros */
  budget?: number;
  /** One-off spending (e.g. buying a house): shown apart, left out of monthly totals and budgets */
  extraordinary?: boolean;
  order: number;
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
  /** Free labels, plus the debt ones: A receber, Devo, Acerto de contas */
  tags?: string[];
  /** Person this transfer went to or came from */
  personId?: number;
  /** Cash withdrawal (ATM): money moved to the Dinheiro account */
  cash?: boolean;
  /** Month this movement counts toward in reports, when it differs from its date (computed, never stored) */
  statsMonth?: string;
  /** You confirmed this own transfer is between tracked accounts, even without a matching movement */
  confirmed?: boolean;
  source: 'import' | 'manual';
  note?: string;
  importId?: number;
}

export interface Rule {
  id?: number;
  pattern: string; // normalized substring
  categoryId: string;
  /** Rule learned from money coming in (only applies to income) */
  income?: boolean;
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
  /** Account keys hidden from the home screen (mil, bkt, pot:<name>, inv:<id>) */
  hiddenAccounts: string[];
  /** Salary received on or after this day of the month counts toward the next month in reports (off when unset) */
  salaryShiftDay?: number;
  /** The data is the built-in example set */
  demo?: boolean;
  /** You cleared the example data; don't load it again automatically */
  demoDismissed?: boolean;
}

export interface Person {
  id?: number;
  /** How you want to see them, e.g. "Maria (irmã)" */
  name: string;
  /** Name as the bank writes it, e.g. "MARIA EDUARDA CARMO FELIX" (matched as whole words) */
  match: string;
  relation: 'familia' | 'amigos' | 'outro';
}

export interface Goal {
  id?: number;
  name: string;
  icon: string;
  /**
   * balance: reach a balance in one account (or 'networth' for everything)
   * monthly: put aside an amount every month (appartes + investments)
   */
  type: 'balance' | 'monthly';
  account?: string;
  target: number;
  deadline?: string; // YYYY-MM-DD
  createdAt: number;
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
