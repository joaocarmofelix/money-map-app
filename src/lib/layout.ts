/** The sections of each page that can be put in a different order (v1.1). */
export const PAGES = {
  home: {
    title: 'Início',
    sections: [
      { id: 'accounts', label: 'Contas' },
      { id: 'goals', label: 'Objetivos' },
      { id: 'alerts', label: 'Avisos' },
      { id: 'recent', label: 'Últimos movimentos' },
    ],
  },
  month: {
    title: 'Resumo · Mês',
    sections: [
      { id: 'summary', label: 'Mês em resumo' },
      { id: 'donut', label: 'Para onde foi o dinheiro' },
      { id: 'flow', label: 'Entrou, saiu e poupaste' },
      { id: 'budgets', label: 'Orçamentos' },
      { id: 'extra', label: 'Despesas extraordinárias' },
    ],
  },
  year: {
    title: 'Resumo · Ano',
    sections: [
      { id: 'totals', label: 'Totais do ano' },
      { id: 'months', label: 'Mês a mês' },
      { id: 'budgets', label: 'Orçamentos no ano' },
      { id: 'donut', label: 'Para onde foi o dinheiro' },
      { id: 'table', label: 'Por categoria' },
    ],
  },
} as const;

export type PageId = keyof typeof PAGES;

/**
 * The order to show a page's sections in: the saved order first, ignoring ids that no longer
 * exist, with any section added in a later version slotted in next to its default neighbour.
 */
export function arrange(page: PageId, saved?: string[]): string[] {
  const defaults = PAGES[page].sections.map((s) => s.id as string);
  const out = (saved ?? []).filter((id, i, a) => defaults.includes(id) && a.indexOf(id) === i);
  // A section that's not in the saved order goes right after the one it follows by default.
  defaults.forEach((id, i) => {
    if (!out.includes(id)) out.splice(i === 0 ? 0 : out.indexOf(defaults[i - 1]) + 1, 0, id);
  });
  return out;
}
