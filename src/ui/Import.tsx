import { useEffect, useState } from 'react';
import { needsCategory } from '../lib/tags';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { parseFile } from '../lib/parsers';
import { db, deleteImport, importContents, runImport } from '../lib/db';
import type { ImportLog } from '../lib/types';
import { Sheet, toast } from './kit';
import type { Reconciliation } from '../lib/importer';
import { ReconcileSheet } from './Reconcile';
import { isNative, shareFile } from '../lib/native';

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

const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase().slice(0, 4);
const dmy = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

export function ImportPage({ onTriage }: { onTriage: (intro?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Outcome[]>([]);
  const [recon, setRecon] = useState<{ list: Reconciliation[]; intro: string | null } | null>(null);
  const history = useLiveQuery(() => db.imports.orderBy('at').reverse().limit(12).toArray(), []);
  const [del, setDel] = useState<ImportLog | null>(null);
  const withFile = useLiveQuery(async () => new Set((await db.files.toCollection().primaryKeys()) as number[]), []);

  async function download(id: number) {
    const f = await db.files.get(id);
    if (!f) return;
    if (isNative()) {
      // The Android app can't "download"; open the share sheet so you can open or send it.
      await shareFile(f.name, f.blob, f.name).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: Outcome[] = [];
    const recons: Reconciliation[] = [];
    for (const f of Array.from(files)) {
      try {
        const parsed = await parseFile(f);
        if (!parsed.txs.length) {
          out.push({ file: f.name, bank: parsed.bank, added: 0, skipped: 0, merged: 0, warnings: ['Não encontrei movimentos neste ficheiro, por isso nada foi importado.', ...parsed.warnings] });
          continue;
        }
        const plan = await runImport(f.name, parsed, f);
        recons.push(...plan.recon);
        const dates = parsed.txs.map((t) => t.date).sort();
        out.push({ file: f.name, bank: parsed.bank, open: plan.add.filter(needsCategory).length, added: plan.add.length, skipped: plan.skipped, merged: plan.merges.length, tooOld: plan.tooOld, from: dates[0], to: dates[dates.length - 1], warnings: parsed.warnings });
      } catch (e) {
        out.push({ file: f.name, bank: '?', added: 0, skipped: 0, merged: 0, warnings: [`Não consegui ler o ficheiro: ${(e as Error).message}`] });
      }
    }
    setResults(out);
    setBusy(false);
    const added = out.reduce((a, r) => a + r.added, 0);
    const open = await db.txs.filter(needsCategory).count();
    const auto = added - out.reduce((a, r) => a + (r.open ?? 0), 0);
    const intro = added > 0 && open > 0 ? `${added} movimentos importados${auto > 0 ? `, ${auto} já categorizados ou marcados como transferência` : ''}. Falta categorizar ${open}.` : null;
    // Show the comparison first when you had logged anything by hand; then go on to categorize.
    const relevant = recons.filter((r) => r.manualCount > 0 || r.leftover.length > 0);
    if (relevant.length) setRecon({ list: relevant, intro });
    else if (intro) onTriage(intro);
  }

  return (
    <div className="stack">
      {recon && (
        <ReconcileSheet
          recon={recon.list}
          onClose={async () => {
            const intro = recon.intro;
            setRecon(null);
            const open = await db.txs.filter(needsCategory).count();
            if (open > 0) onTriage(intro ?? undefined);
          }}
        />
      )}
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
      </section>

      {history && history.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Importações anteriores</h2>
          </div>
          {history.map((h) => (
            <div key={h.id} className="imp-row small">
              <span className="imp-t">
                <b>{h.account}</b> <span className="muted">· {dmy(h.from)} a {dmy(h.to)}</span>
                <span className="muted imp-f">{h.fileName}</span>
              </span>
              <span className="muted num">+{h.added}</span>
              {withFile?.has(h.id!) ? (
                <button className="file-btn" onClick={() => download(h.id!)} aria-label={`Descarregar ${h.fileName}`} title="Descarregar o extrato">
                  <Download size={15} />
                  {ext(h.fileName)}
                </button>
              ) : (
                <span className="file-btn off" title="Importado antes de a app guardar os ficheiros">
                  {ext(h.fileName)}
                </span>
              )}
              <button className="icon-btn sm imp-del" onClick={() => setDel(h)} aria-label={`Apagar a importação de ${h.fileName}`} title="Apagar esta importação">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      )}
      {del && <DeleteImportSheet imp={del} onClose={() => setDel(null)} />}
    </div>
  );
}

/** Undo one import, e.g. to read the same statement again after a fix. */
function DeleteImportSheet({ imp, onClose }: { imp: ImportLog; onClose: () => void }) {
  const [info, setInfo] = useState<{ count: number; manual: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    importContents(imp.id!).then(setInfo);
  }, [imp.id]);

  async function confirm() {
    setBusy(true);
    const r = await deleteImport(imp.id!);
    toast(r.removed ? `Importação apagada: ${r.removed} ${r.removed === 1 ? 'movimento' : 'movimentos'}` : 'Importação apagada');
    onClose();
  }

  return (
    <Sheet onClose={onClose} label="Apagar importação" title="Apagar importação?">
      <div className="stack" style={{ gap: 12 }}>
        <p style={{ margin: 0 }}>
          <b>{imp.fileName}</b>
          <span className="muted">
            {' '}
            · {imp.account} · {dmy(imp.from)} a {dmy(imp.to)}
          </span>
        </p>
        {info && (
          <ul className="small del-list">
            <li>
              {info.count === 0
                ? 'Não há movimentos ligados a esta importação; só sai da lista.'
                : `${info.count} ${info.count === 1 ? 'movimento' : 'movimentos'} deste extrato ${info.count === 1 ? 'é apagado' : 'são apagados'}, e o ficheiro também.`}
            </li>
            {info.manual > 0 && (
              <li>
                {info.manual} {info.manual === 1 ? 'gasto que apontaste à mão volta' : 'gastos que apontaste à mão voltam'} a aparecer como manual.
              </li>
            )}
            {info.count > 0 && <li>As categorias, notas e pessoas que lhes deste ficam guardadas e voltam se importares o mesmo extrato outra vez.</li>}
          </ul>
        )}
        <button className="btn danger" disabled={busy || !info} onClick={confirm}>
          <Trash2 size={16} /> Apagar importação
        </button>
        <button className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
