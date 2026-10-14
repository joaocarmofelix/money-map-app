import { useState } from 'react';
import { Sheet, CategoryGrid, toast } from './shared';
import { db } from '../lib/db';
import { ACCOUNTS } from '../lib/categories';
import { today } from '../lib/text';

const LAST_ACC = 'moneymap:lastAccount';
function lastAccount() {
  try {
    return localStorage.getItem(LAST_ACC) ?? 'mil';
  } catch {
    return 'mil';
  }
}

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<string>();
  const [account, setAccount] = useState(lastAccount);
  const [date, setDate] = useState(today());
  const [income, setIncome] = useState(false);

  const value = parseFloat(amount.replace(',', '.'));
  const ok = Number.isFinite(value) && value > 0 && !!cat;

  async function save() {
    if (!ok) return;
    const signed = Math.round((income ? value : -value) * 100) / 100;
    await db.txs.add({
      key: `manual|${crypto.randomUUID()}`,
      account,
      date,
      amount: signed,
      description: desc.trim() || (income ? 'Entrada' : 'Gasto'),
      kind: income ? 'income' : 'expense',
      categoryId: cat,
      source: 'manual',
    });
    try {
      localStorage.setItem(LAST_ACC, account);
    } catch {
      /* not essential */
    }
    toast(account === 'cash' ? 'Gasto guardado' : 'Guardado. Junta-se ao movimento do banco quando importares o extrato.');
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Adicionar gasto">
      <div className="seg" role="group" aria-label="Tipo">
        <button aria-pressed={!income} onClick={() => (setIncome(false), setCat(undefined))}>
          Gasto
        </button>
        <button aria-pressed={income} onClick={() => (setIncome(true), setCat(undefined))}>
          Entrada
        </button>
      </div>
      <div className="field">
        <input
          className="amount-in num"
          inputMode="decimal"
          placeholder="0,00 €"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-label="Valor"
        />
      </div>
      <div className="field">
        <input placeholder="O quê? (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Descrição" />
      </div>
      <CategoryGrid value={cat} onPick={setCat} income={income} />
      <div className="row">
        <div className="field">
          <label htmlFor="acc">Pago com</label>
          <select id="acc" value={account} onChange={(e) => setAccount(e.target.value)}>
            {ACCOUNTS.filter((a) => !a.isSavings).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date">Dia</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <button className="btn" disabled={!ok} style={{ opacity: ok ? 1 : 0.5 }} onClick={save}>
        Guardar {income ? 'entrada' : 'gasto'}
      </button>
    </Sheet>
  );
}
