/**
 * Slow flowing lines behind the whole app, drifting diagonally.
 * Each wave repeats every 200 units, so sliding it by 400 loops seamlessly; the layer is tilted,
 * so the slide reads as a diagonal drift.
 */
function wave(y: number, amp: number) {
  let d = `M0 ${y} Q50 ${y - amp} 100 ${y}`;
  for (let x = 200; x <= 1600; x += 100) d += ` T${x} ${y}`;
  return d;
}

const WAVES = [
  { y: 120, amp: 26, w: 22, o: 0.05, s: 26 },
  { y: 260, amp: 18, w: 8, o: 0.07, s: 18, rev: true },
  { y: 420, amp: 30, w: 30, o: 0.04, s: 34 },
  { y: 590, amp: 22, w: 12, o: 0.06, s: 22, rev: true },
  { y: 760, amp: 28, w: 24, o: 0.045, s: 30 },
  { y: 920, amp: 16, w: 8, o: 0.06, s: 20 },
];

export function BgWaves() {
  return (
    <div className="app-bg" aria-hidden>
      <svg viewBox="0 0 1200 1000" preserveAspectRatio="xMidYMid slice">
        {WAVES.map((v, i) => (
          <path
            key={i}
            d={wave(v.y, v.amp)}
            style={{ strokeWidth: v.w, opacity: v.o, animationDuration: `${v.s}s`, animationDirection: v.rev ? 'reverse' : 'normal' }}
          />
        ))}
      </svg>
    </div>
  );
}
