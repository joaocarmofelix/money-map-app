import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp } from 'lucide-react';
import { parseFile } from '../lib/parsers';
import { db, runImport } from '../lib/db';

interface Outcome {
  file: string;
  bank: string;
  added: number;
  skipped: number;
  merged: number;
  tooOld?: number;
  /** New movements still without a category */
  open?: number;
  from?: string;
  to?: string;
  warnings: string[];
}

const dmy = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

export function ImportPage({ onTriage }: { onTriage: (intro?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Outcome[]>([]);
  const history = useLiveQuery(() => db.imports.orderBy('at').reverse().limit(12).toArray(), []);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: Outcome[] = [];
    for (const f of Array.from(files)) {
      try {
        const parsed = await parseFile(f);
        if (!parsed.txs.length) {
          out.push({ file: f.name, bank: parsed.bank, added: 0, skipped: 0, merged: 0, warnings: parsed.warnings.length ? parsed.warnings : ['Não encontrei movimentos neste ficheiro.'] });
          continue;
        }
        const plan = await runImport(f.name, parsed);
        const dates = parsed.txs.map((t) => t.date).sort();
        out.push({ file: f.name, bank: parsed.bank, open: plan.add.filter((t) => !t.categoryId && t.kind !== 'transfer').length, added: plan.add.length, skipped: plan.skipped, merged: plan.merges.length, tooOld: plan.tooOld, from: dates[0], to: dates[dates.length - 1], warnings: parsed.warnings });
      } catch (e) {
        out.push({ file: f.name, bank: '?', added: 0, skipped: 0, merged: 0, warnings: [`Não consegui ler o ficheiro: ${(e as Error).message}`] });
      }
    }
    setResults(out);
    setBusy(false);
    const added = out.reduce((a, r) => a + r.added, 0);
    const open = await db.txs.filter((t) => !t.categoryId && t.kind !== 'transfer').count();
    if (added > 0 && open > 0) {
      const auto = added - out.reduce((a, r) => a + (r.open ?? 0), 0);
      onTriage(
        `${added} movimentos importados${auto > 0 ? `, ${auto} já categorizados ou marcados como transferência` : ''}. Falta categorizar ${open}.`,
      );
    }
  }

  return (
    <div className="stack">
      <label className="drop">
        <input type="file" accept=".pdf,.xls,.xlsx,application/pdf" multiple onChange={(e) => (handle(e.target.files), (e.target.value = ''))} />
        <span className="qi">
          <FileUp size={24} />
        </span>
        <b>{busy ? 'A ler…' : 'Escolher extratos'}</b>
        <span className="small muted">PDF do Millennium ou Excel do Bankinter. Podes escolher vários; os repetidos são ignorados.</span>
      </label>

      {results.map((r, i) => (
        <section className="card result" key={i}>
          <b>
            {r.bank !== '?' ? r.bank : r.file}
            {r.from && <span className="muted"> · {dmy(r.from)} a {dmy(r.to)}</span>}
          </b>
          <ul className="small">
            {r.added > 0 && <li>{r.added} movimentos novos</li>}
            {r.skipped > 0 && <li>{r.skipped} já existiam e foram ignorados</li>}
            {!!r.tooOld && <li>{r.tooOld} anteriores à data de início ficaram de fora</li>}
            {r.merged > 0 && <li>{r.merged} gastos apontados à mão foram ligados ao movimento do banco</li>}
            {r.warnings.map((w) => (
              <li key={w} className="warn-t">
                {w}
              </li>
            ))}
          </ul>
          {r.added > 0 && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => onTriage()}>
              Categorizar agora
            </button>
          )}
        </section>
      ))}

      <section className="card">
        <div className="card-head">
          <h2>Como exportar</h2>
        </div>
        <details className="how">
          <summary>Millennium</summary>
          <ol className="small">
            <li>Abre o email mensal com o extrato (ou o site, em Documentos digitais).</li>
            <li>Guarda o PDF e escolhe-o aqui. Inclui a conta à ordem e os appartes.</li>
          </ol>
        </details>
        <details className="how">
          <summary>Bankinter</summary>
          <ol className="small">
            <li>No site, abre os movimentos da conta e exporta para Excel.</li>
            <li>Podes exportar os últimos 90 dias quando quiseres: a app só guarda o que ainda não tem.</li>
            <li>Se o ficheiro disser “Últimos 15 movimentos”, filtra por datas antes de exportar.</li>
          </ol>
        </details>
        <details className="how">
          <summary>Cartão refeição</summary>
          <p className="small muted">Fica de fora de propósito. A app mostra a comida paga com os outros cartões, que é o que queres reduzir.</p>
        </details>
      </section>

      {history && history.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Importações anteriores</h2>
          </div>
          {history.map((h) => (
            <div key={h.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span>
                <b>{h.account}</b> <span className="muted">· {dmy(h.from)} a {dmy(h.to)}</span>
              </span>
              <span className="muted num">+{h.added}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
