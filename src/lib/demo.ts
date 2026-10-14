import type { Goal, Person, Rule, Settings, Tx } from './types';

/**
 * Six months of made-up but realistic data for trying the app.
 * Descriptions follow the banks' own wording so rules and suggestions behave like with real statements.
 */

// Small seeded random generator so the demo is the same every time.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const OWNER = 'JOAO EXEMPLO';

interface Ev {
  account: string;
  date: string;
  amount: number;
  description: string;
  categoryId?: string;
  kind?: Tx['kind'];
  pot?: string;
  invest?: string;
  personId?: number;
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function buildDemo(todayIso: string) {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const amt = (lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100;
  const endYm = todayIso.slice(0, 7);
  const lastDay = Number(todayIso.slice(8, 10)) - 1;
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(endYm.slice(0, 4)), Number(endYm.slice(5, 7)) - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const ev: Ev[] = [];
  const add = (e: Ev) => ev.push(e);
  const card = (m: string, day: number, merchant: string, lo: number, hi: number, cat: string, account = 'mil') =>
    add({ account, date: `${m}-${pad(day)}`, amount: -amt(lo, hi), description: `COMPRA 7782 ${merchant} CONTACTLESS`, categoryId: cat });

  months.forEach((m, mi) => {
    const current = m === endYm;
    const days = current ? lastDay : 28;
    const d = (n: number) => Math.min(n, days);
    // The current month is only partly over, so it gets proportionally fewer purchases.
    const k = (n: number) => Math.max(1, Math.round((n * days) / 30));

    // Income
    if (!current) add({ account: 'mil', date: `${m}-27`, amount: 1668.24, description: 'PAGAMENTO DE VENCIMENTO', categoryId: 'salario' });
    if (m.endsWith('-07') || m.endsWith('-12')) add({ account: 'mil', date: `${m}-20`, amount: 1580, description: 'PAGAMENTO DE SUBSIDIO', categoryId: 'subsidios' });
    if (mi === 3) add({ account: 'mil', date: `${m}-14`, amount: 412.37, description: 'TRF DE AUTORIDADE TRIBUTARIA REEMBOLSO IRS', categoryId: 'irs' });

    // Savings at the start of the month: appartes and Trading 212
    if (d(2) >= 2) {
      for (const [pot, v] of [['Stocks', 300], ['Fun', 60], ['Future Goals', 150]] as const) {
        add({ account: 'mil', date: `${m}-02`, amount: -v, description: `TRF P/ MillenniumBcp     ${pot}`, kind: 'transfer', pot });
        add({ account: 'mil-apparte', date: `${m}-02`, amount: v, description: `TRF DE Transferencia MillenniumBcp ${pot}`, kind: 'transfer', pot });
      }
      add({ account: 'mil', date: `${m}-03`, amount: -150, description: 'TRF P/ Trading 212 Markets Ltd', kind: 'transfer', invest: 't212' });
    }
    // Money moved to Bankinter every other month
    if (mi % 2 === 1 && d(10) >= 10) {
      add({ account: 'mil', date: `${m}-10`, amount: -250, description: `TRF P/ ${OWNER}`, kind: 'transfer' });
      add({ account: 'bkt', date: `${m}-10`, amount: 250, description: `Transf Imed de ${OWNER}`, kind: 'transfer' });
    }
    // Fun pot spent once
    if (mi === 2) {
      add({ account: 'mil-apparte', date: `${m}-18`, amount: -200, description: 'TRF P/ Transferencia MillenniumBcp Fun', kind: 'transfer', pot: 'Fun' });
      add({ account: 'mil', date: `${m}-18`, amount: 200, description: 'TRF DE Transferencia MillenniumBcp Fun', kind: 'transfer', pot: 'Fun' });
    }

    // Bills and subscriptions
    if (d(5) >= 5) add({ account: 'mil', date: `${m}-05`, amount: -29.99, description: 'PAG BXVAL- 7782 VODAFONE PORTUGAL', categoryId: 'net' });
    if (d(8) >= 8) add({ account: 'mil', date: `${m}-08`, amount: -amt(28, 46), description: 'PAG BXVAL- 7782 EDP COMERCIAL', categoryId: 'luz' });
    if (d(9) >= 9) add({ account: 'mil', date: `${m}-09`, amount: -13.99, description: 'COMPRA 7782 NETFLIX.COM AMSTERDAM', categoryId: 'streaming' });
    if (d(12) >= 12) add({ account: 'mil', date: `${m}-12`, amount: -7.99, description: 'COMPRA 7782 SPOTIFY STOCKHOLM', categoryId: 'musica' });
    if (d(1) >= 1) add({ account: 'mil', date: `${m}-01`, amount: -40, description: 'COMPRA 7782 METRO LISBOA LISBOA', categoryId: 'transp' });

    // Day-to-day
    const supers = ['PINGO DOCE LISBOA', 'LIDL AGRADECE AMADORA', 'CONTINENTE CAPARICA M.', 'PINGO DOCE ALMADA'];
    for (let i = 0; i < k(7); i++) card(m, 1 + Math.floor(r() * days), pick(supers), 8, 48, 'super');
    for (let i = 0; i < k(4); i++) card(m, 1 + Math.floor(r() * days), pick(['TASCA DO CHICO LISBOA', 'O TALHO LISBOA', 'SUSHI KO ALMADA', 'H3 ALMADA FORUM']), 9, 32, 'rest');
    for (let i = 0; i < k(2); i++) add({ account: 'mil', date: `${m}-${pad(1 + Math.floor(r() * days))}`, amount: -amt(14, 26), description: 'COMPRA 7782 UBER EATS PARIS', categoryId: 'delivery' });
    for (let i = 0; i < k(5); i++) card(m, 1 + Math.floor(r() * days), pick(['PASTELARIA VERSAILLES', 'STARBUCKS SALDANHA', 'PADARIA PORTUGUESA']), 1.2, 6.5, 'cafe');
    for (let i = 0; i < k(2); i++) card(m, 1 + Math.floor(r() * days), pick(['A2 FOGUETEIRO', 'PONTE 25 DE ABRIL ALMAD']), 1.9, 3.4, 'portagens');
    if (r() > 0.3) card(m, 1 + Math.floor(r() * days), 'GALP ALMADA', 35, 60, 'combust');
    // One Piece TCG, a bit more every month
    for (let i = 0; i < (current ? 1 : 1 + (mi % 3)); i++) add({ account: 'mil', date: `${m}-${pad(1 + Math.floor(r() * days))}`, amount: -amt(12, 55), description: pick(['COMPRA 7782 CARDMARKET BERLIN', 'COMPRA 7782 LOJA DO TCG LISBOA CONTACTLESS']), categoryId: 'onepiece' });
    if (r() > 0.5) add({ account: 'mil', date: `${m}-${pad(1 + Math.floor(r() * days))}`, amount: -amt(10, 60), description: 'COMPRA 7782 STEAMGAMES.COM BELLEVUE', categoryId: 'jogos' });
    if (r() > 0.4) card(m, 1 + Math.floor(r() * days), pick(['ZARA COLOMBO LISBOA', 'PRIMARK ALMADA']), 15, 60, 'vestuario');
    if (r() > 0.5) card(m, 1 + Math.floor(r() * days), 'BARBEARIA LISBOA', 12, 12, 'cabeleireiro');
    if (r() > 0.6) card(m, 1 + Math.floor(r() * days), 'FARMACIA ALMADA', 5, 25, 'farmacia');
    if (r() > 0.6) card(m, 1 + Math.floor(r() * days), pick(['WORTEN 2650-435 LISBOA', 'FNAC ALMADA']), 20, 90, 'tecnologia');
    if (r() > 0.5) add({ account: 'mil', date: `${m}-${pad(1 + Math.floor(r() * days))}`, amount: -amt(8, 30), description: 'TRF MB WAY P/ RICARDO AMIGO CS', categoryId: 'amigos' });
    // Family: a sister who sometimes sends money back, sometimes gets some
    if (mi % 2 === 0 && d(16) >= 16) add({ account: 'mil', date: `${m}-16`, amount: -amt(15, 40), description: 'TRF MB WAY P/ MARIA EXEMPLO CS', categoryId: 'familia', personId: 1, note: pick(['Metade das compras para casa', 'Prenda da mãe (metade)', 'Bilhetes do concerto']) });
    if (mi % 3 === 1 && d(20) >= 20) add({ account: 'mil', date: `${m}-20`, amount: amt(20, 60), description: 'TRF. P/O MARIA EXEMPLO', categoryId: 'pessoas-in', personId: 1, note: 'Devolveu o que lhe emprestei' });
  });

  // A transfer to an old Caixa account (no other side), to show the "sem par" alert
  add({ account: 'mil', date: `${months[2]}-21`, amount: -120, description: `TRF P/ ${OWNER}`, kind: 'transfer' });
  // Buying a house: deposit and mortgage-process fees from Bankinter
  add({ account: 'bkt', date: `${months[4]}-15`, amount: -5000, description: 'Trf Imediata p/ IMOBILIARIA EXEMPLO - Sinal CPCV', categoryId: 'cc-sinal' });
  add({ account: 'bkt', date: `${months[5]}-07`, amount: -250, description: 'PHB-205-2026/0000001-COMIS SOLICITAD', categoryId: 'cc-credito' });
  add({ account: 'bkt', date: `${months[5]}-07`, amount: -90, description: 'PHB-205-2026/0000001-COM TRAMITACAO', categoryId: 'cc-credito' });
  // This month: a booster box and a birthday dinner, so a couple of budgets get tight
  add({ account: 'mil', date: `${endYm}-${pad(Math.min(9, lastDay))}`, amount: -129.9, description: 'COMPRA 7782 CARDMARKET BERLIN', categoryId: 'onepiece' });
  add({ account: 'mil', date: `${endYm}-${pad(Math.min(11, lastDay))}`, amount: -64.5, description: 'COMPRA 7782 RESTAURANTE O PATEO LISBOA CONTACTLESS', categoryId: 'rest', });
  // A few recent movements left to categorize
  const m = endYm;
  const recent = Math.max(2, lastDay - 4);
  add({ account: 'mil', date: `${m}-${pad(recent)}`, amount: -23.4, description: 'COMPRA 7782 IKEA ALFRAGIDE CAIXAS A CONTACTLESS' });
  add({ account: 'mil', date: `${m}-${pad(recent)}`, amount: -6.5, description: 'COMPRA 7782 CINEMA NOS ALMADA FORUM CONTACTLESS' });
  add({ account: 'mil', date: `${m}-${pad(recent + 1)}`, amount: -31.2, description: 'COMPRA 7782 DECATHLON AMADORA CONTACTLESS' });
  add({ account: 'mil', date: `${m}-${pad(recent + 2)}`, amount: -14.9, description: 'COMPRA 7782 BERTRAND CHIADO LISBOA CONTACTLESS' });
  add({ account: 'bkt', date: `${m}-${pad(recent + 2)}`, amount: -57.5, description: 'I V A' });

  // Running balances per account (bank-style), oldest first
  const start: Record<string, number> = { mil: 1450, bkt: 6800, 'mil-apparte': 6800 };
  ev.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const bal = { ...start };
  const txs: Tx[] = ev.map((e, i) => {
    bal[e.account] = Math.round((bal[e.account] + e.amount) * 100) / 100;
    return {
      key: `demo|${i}`,
      account: e.account,
      date: e.date,
      amount: e.amount,
      description: e.description,
      balance: bal[e.account],
      kind: e.kind ?? (e.amount < 0 ? 'expense' : 'income'),
      categoryId: e.categoryId,
      pot: e.pot,
      invest: e.invest,
      personId: e.personId,
      note: e.note,
      source: 'import' as const,
    };
  });

  const rules: Rule[] = [
    ['PINGO', 'super'], ['LIDL', 'super'], ['CONTINENTE', 'super'], ['UBER EATS', 'delivery'], ['NETFLIX', 'streaming'],
    ['SPOTIFY', 'musica'], ['VODAFONE', 'net'], ['EDP', 'luz'], ['METRO', 'transp'], ['GALP', 'combust'],
    ['PONTE', 'portagens'], ['A2', 'portagens'], ['CARDMARKET', 'onepiece'], ['LOJA DO TCG', 'onepiece'], ['STEAMGAMES', 'jogos'],
    ['PASTELARIA', 'cafe'], ['STARBUCKS', 'cafe'], ['PADARIA', 'cafe'], ['PHB', 'cc-credito'], ['ZARA', 'vestuario'],
    ['PRIMARK', 'vestuario'], ['BARBEARIA', 'cabeleireiro'], ['FARMACIA', 'farmacia'], ['WORTEN', 'tecnologia'], ['FNAC', 'tecnologia'],
  ].map(([pattern, categoryId]) => ({ pattern, categoryId, createdAt: Date.now() }));

  const goals: Goal[] = [
    { name: 'Juntar 10 000 € no Stocks', icon: 'trending', type: 'balance', account: 'pot:Stocks', target: 10000, deadline: '2027-12-31', createdAt: 1 },
    { name: 'Pôr de parte 650 € por mês', icon: 'piggy', type: 'monthly', target: 650, createdAt: 2 },
    { name: 'Primeiros 20 mil', icon: 'trophy', type: 'balance', account: 'networth', target: 20000, createdAt: 3 },
  ];

  const settings: Settings & { demo: true } = {
    ownerNames: [OWNER],
    potStart: { Stocks: 4000, Fun: 300, 'Future Goals': 2500 },
    trackFrom: `${months[0]}-01`,
    investStart: { t212: 1741 },
    hiddenAccounts: [],
    demo: true,
  };

  const budgets: Record<string, number> = { super: 230, comerfora: 170, lazer: 150, mobilidade: 140, subscricoes: 35, roupa: 70, casa: 90 };
  const people: Person[] = [{ id: 1, name: 'Maria (irmã)', match: 'MARIA EXEMPLO', relation: 'familia' }];
  return { txs, rules, goals, settings, budgets, people };
}
