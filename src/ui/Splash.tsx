import { useEffect, useState } from 'react';
import type { Settings } from '../lib/types';
import { Mascot } from './Companion';

/** The app symbol (route from € to a map pin), for when the companion is turned off. */
function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="96 80 360 330" aria-hidden className="splash-logo">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M244 346 C 300 340, 290 262, 344 266 C 372 268, 384 252, 384 230" stroke="#fff" strokeWidth="30" />
        <path d="M212 300 A54 54 0 1 0 212 384" stroke="#fff" strokeWidth="28" />
        <path d="M112 330 H196 M112 356 H190" stroke="#fff" strokeWidth="18" />
        <path d="M384 238 C 368 220 330 188 330 150 a54 54 0 0 1 108 0 c0 38 -38 70 -54 88 z" fill="#2fd08f" stroke="none" />
        <circle cx="384" cy="150" r="20" fill="#2547d0" />
      </g>
    </svg>
  );
}

const reduced = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Opening animation: your Pin drops onto the screen like a map pin landing, the name appears,
 * then everything fades into the app. About a second and a half.
 */
export function Splash({ settings, onDone }: { settings?: Settings; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const quick = reduced();
  useEffect(() => {
    if (!settings) return;
    const t1 = setTimeout(() => setLeaving(true), quick ? 350 : 1350);
    const t2 = setTimeout(onDone, quick ? 600 : 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!settings]);
  const pin = settings?.companion !== false;
  return (
    <div className={`splash${leaving ? ' leaving' : ''}${quick ? ' quick' : ''}`} aria-hidden>
      {settings && (
        <div className="splash-in">
          <div className="splash-drop">{pin ? <Mascot size={112} look={settings.pin} /> : <Logo size={120} />}</div>
          <div className="splash-name">MoneyMap</div>
        </div>
      )}
    </div>
  );
}
