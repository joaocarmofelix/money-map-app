import { useState } from 'react';
import { fmt, MONTHS } from '../lib/text';

export interface Slice {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** Spending split. Tap a slice or legend row to read it in the centre. */
export function Donut({ slices, total, caption }: { slices: Slice[]; total: number; caption: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const size = 150;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2.5 : 0;
  let acc = 0;
  const active = slices.find((s) => s.id === sel);

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${caption}: ${fmt(total)}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {slices.map((s) => {
            const len = total > 0 ? (s.value / total) * C : 0;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={sel === s.id ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acc}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                opacity={sel && sel !== s.id ? 0.35 : 1}
                style={{ cursor: 'pointer', transition: 'opacity .15s' }}
                onClick={() => setSel(sel === s.id ? null : s.id)}
              >
                <title>
                  {s.label}: {fmt(s.value)}
                </title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="center">
          <b className="num">{fmt(active ? active.value : total)}</b>
          <small>{active ? active.label : caption}</small>
        </div>
      </div>
      <ul className="legend">
        {slices.map((s) => (
          <li key={s.id}>
            <button aria-pressed={sel === s.id} onClick={() => setSel(sel === s.id ? null : s.id)}>
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className="num muted">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarDatum {
  ym: string;
  value: number;
  empty?: boolean;
}

/** Monthly totals with an optional dashed limit line. One series, one colour; the chosen month is solid. */
export function MonthBars({
  data,
  selected,
  limit,
  onSelect,
  color = 'var(--primary)',
}: {
  data: BarDatum[];
  selected: string;
  limit?: number;
  onSelect?: (ym: string) => void;
  color?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 320;
  const H = 150;
  const top = 18;
  const bottom = 22;
  const plotH = H - top - bottom;
  const max = Math.max(1, limit ?? 0, ...data.map((d) => d.value)) * 1.08;
  const bw = W / data.length;
  const barW = Math.min(30, bw * 0.55);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const shown = data.find((d) => d.ym === (hover ?? selected));
  const shownIdx = data.findIndex((d) => d.ym === shown?.ym);

  return (
    <div className="bars-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gastos por mês">
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} stroke="var(--line)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * bw + (bw - barW) / 2;
          const h = Math.max(d.value > 0 ? 3 : 0, top + plotH - y(d.value));
          const isSel = d.ym === selected;
          const over = limit !== undefined && d.value > limit;
          return (
            <g
              key={d.ym}
              onMouseEnter={() => setHover(d.ym)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(d.ym)}
              style={{ cursor: onSelect ? 'pointer' : undefined }}
            >
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <path
                d={roundedTop(x, top + plotH - h, barW, h, Math.min(5, h))}
                fill={over ? 'var(--bad)' : color}
                opacity={isSel ? 1 : 0.38}
              />
              <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={isSel ? 'var(--ink)' : 'var(--ink-2)'} fontWeight={isSel ? 800 : 500}>
                {MONTHS[Number(d.ym.slice(5)) - 1].slice(0, 3)}
              </text>
            </g>
          );
        })}
        {limit !== undefined && limit > 0 && (
          <>
            <line x1={0} x2={W} y1={y(limit)} y2={y(limit)} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" />
             <text x={2} y={y(limit) - 5} textAnchor="start" fontSize={10.5} fill="var(--ink-2)" fontWeight={700}>
              Orçamento {fmt(limit)}
            </text>
          </>
        )}
      </svg>
      {shown && !shown.empty && (
        <div className="tip num" style={{ left: `${((shownIdx + 0.5) / data.length) * 100}%` }}>
          {fmt(shown.value)}
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Small progress ring for a single goal. */
export function Ring({ value, size = 64, color }: { value: number; size?: number; color: string }) {
  const s = 7;
  const r = (size - s) / 2;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={s} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
        strokeDasharray={`${Math.min(1, value) * C} ${C}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export interface FlowDatum {
  ym: string;
  income: number;
  spent: number;
  saved: number;
  empty?: boolean;
}

const FLOW = [
  { key: 'income', label: 'Entrou', color: 'var(--s3)' },
  { key: 'spent', label: 'Saiu', color: 'var(--s2)' },
  { key: 'saved', label: 'Poupado', color: 'var(--s1)' },
] as const;

/**
 * Three bars per month: money in, money spent, money put aside (appartes + investments).
 * Tap a month to select it; the tooltip shows the three values.
 */
export function FlowBars({ data, selected, onSelect }: { data: FlowDatum[]; selected?: string; onSelect?: (ym: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 330;
  const H = 170;
  const top = 10;
  const bottom = 22;
  const plotH = H - top - bottom;
  const max = niceCeil(Math.max(1, ...data.flatMap((d) => [d.income, d.spent, d.saved])));
  const gw = W / data.length;
  const bw = Math.max(3, Math.min(12, (gw * 0.72) / 3 - 2));
  const groupW = bw * 3 + 4;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const focus = hover ?? selected;
  const shown = data.find((d) => d.ym === focus);
  const ticks = [0.5, 1].map((f) => max * f);
  const many = data.length > 8;

  return (
    <div>
      <div className="bars-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entradas, saídas e poupança por mês">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
              <text x={0} y={y(v) - 3} fontSize={9.5} fill="var(--ink-3)">
                {Math.round(v).toLocaleString('pt-PT')} €
              </text>
            </g>
          ))}
          <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} stroke="var(--line)" />
          {data.map((d, i) => {
            const x0 = i * gw + (gw - groupW) / 2;
            const dim = focus && focus !== d.ym ? 0.35 : 1;
            return (
              <g
                key={d.ym}
                onMouseEnter={() => setHover(d.ym)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(d.ym)}
                style={{ cursor: onSelect ? 'pointer' : undefined }}
              >
                <rect x={i * gw} y={0} width={gw} height={H} fill="transparent" />
                {FLOW.map((f, j) => {
                  const v = d[f.key];
                  const h = Math.max(v > 0 ? 2 : 0, top + plotH - y(v));
                  return (
                    <path
                      key={f.key}
                      d={roundedTop(x0 + j * (bw + 2), top + plotH - h, bw, h, Math.min(3, h))}
                      fill={f.color}
                      opacity={dim}
                    />
                  );
                })}
                <text
                  x={i * gw + gw / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={many ? 9.5 : 11}
                  fill={d.ym === selected ? 'var(--ink)' : 'var(--ink-2)'}
                  fontWeight={d.ym === selected ? 800 : 500}
                >
                  {MONTHS[Number(d.ym.slice(5)) - 1].slice(0, many ? 1 : 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flow-key">
        {FLOW.map((f) => (
          <span key={f.key}>
            <i style={{ background: f.color }} />
            {f.label}
            {shown && !shown.empty && <b className="num">{fmt(shown[f.key])}</b>}
          </span>
        ))}
      </div>
      {shown && (
        <p className="small muted" style={{ margin: '4px 0 0', textAlign: 'center' }}>
          {MONTHS[Number(shown.ym.slice(5)) - 1]} {shown.ym.slice(0, 4)}
          {shown.empty ? ' · sem dados' : ` · balanço ${fmt(shown.income - shown.spent - shown.saved)}`}
        </p>
      )}
    </div>
  );
}

/** Round up to a tidy axis maximum: 1, 2, 2.5 or 5 times a power of ten. */
function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
