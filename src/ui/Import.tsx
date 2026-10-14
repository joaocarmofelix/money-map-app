import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { parseFile } from '../lib/parsers';
import { db, getSettings, runImport } from '../lib/db';

interface Outcome {
  file: string;
  bank: string;
  added: number;
  skipped: number;
  merged: number;
  from?: string;
  to?: string;
  warnings: string[];
}

const dmy = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

export function Import({ onNeedName, onTriage }: { onNeedName: () => void; onTriage: () => void }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Outcome[]>([]);
  const history = useLiveQuery(() => db.imports.orderBy('at').reverse().limit(12).toArray(), []);
  const settings = useLiveQuery(getSettings, []);

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
        out.push({
          file: f.name,
          bank: parsed.bank,
          added: plan.add.length,
          skipped: plan.skipped,
          merged: plan.merges.length,
          from: dates[0],
          to: dates[dates.length - 1],
          warnings: parsed.warnings,
        });
      } catch (e) {
        out.push({ file: f.name, bank: '?', added: 0, skipped: 0, merged: 0, warnings: [`Não consegui ler o ficheiro: ${(e as Error).message}`] });
      }
    }
    setResults(out);
    setBusy(false);
  }

  return (
    <>
      <h2>Importar extratos</h2>
      {settings && settings.ownerNames.length === 0 && (
        <button className="nudge" onClick={onNeedName}>
          <span>
            <strong>Diz à app o teu nome</strong>
            <br />
            <span className="muted">Assim as transferências entre as tuas contas não contam como gastos.</span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}
      <label className="drop">
        <input type="file" accept=".pdf,.xls,.xlsx,application/pdf" multiple onChange={(e) => (handle(e.target.files), (e.target.value = ''))} />
        <strong>{busy ? 'A ler…' : 'Escolher ficheiros'}</strong>
        <span className="muted">PDF do Millennium ou Excel do Bankinter. Podes escolher vários de uma vez, os repetidos são ignorados.</span>
      </label>

      {results.map((r, i) => (
        <div className="result" key={i}>
          <strong>
            {r.bank !== '?' ? r.bank : r.file}
            {r.from && ` · ${dmy(r.from)} a ${dmy(r.to)}`}
          </strong>
          <ul>
            {r.added > 0 && <li>{r.added} movimentos novos</li>}
            {r.skipped > 0 && <li>{r.skipped} já existiam e foram ignorados</li>}
            {r.merged > 0 && <li>{r.merged} gastos que apontaste à mão foram ligados ao movimento do banco</li>}
            {r.warnings.map((w) => (
              <li key={w} className="warn">
                {w}
              </li>
            ))}
          </ul>
          {r.added > 0 && (
            <button className="link" onClick={onTriage}>
              Categorizar agora
            </button>
          )}
        </div>
      ))}

      <h2>Como exportar</h2>
      <details className="how">
        <summary>Millennium</summary>
        <ol>
          <li>Abre o email mensal com o extrato (ou o site, em Documentos digitais).</li>
          <li>Guarda o PDF e escolhe-o aqui. O extrato inclui a conta à ordem e os appartes.</li>
        </ol>
      </details>
      <details className="how">
        <summary>Bankinter</summary>
        <ol>
          <li>No site, abre os movimentos da conta e exporta para Excel.</li>
          <li>Podes exportar os últimos 90 dias sempre que quiseres: a app só guarda o que ainda não tem.</li>
          <li>Se o ficheiro disser “Últimos 15 movimentos”, filtra por datas antes de exportar para não perder movimentos.</li>
        </ol>
      </details>
      <details className="how">
        <summary>Cartão refeição</summary>
        <p className="muted">Fica de fora de propósito. A app mostra a comida que pagaste com os outros cartões, que é o que queres reduzir.</p>
      </details>

      {history && history.length > 0 && (
        <>
          <h2>Importações anteriores</h2>
          <ul className="list-plain">
            {history.map((h) => (
              <li key={h.id}>
                <span>
                  {h.account} <span className="muted">· {dmy(h.from)} a {dmy(h.to)}</span>
                </span>
                <span className="muted">+{h.added}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
