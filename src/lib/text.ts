/** Uppercase, strip accents and collapse spaces. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Bank boilerplate that says nothing about where the money went.
const NOISE: RegExp[] = [
  /^COMPRA \d{3,4}\s*/,
  /^PAG BXVAL-? ?\d{3,4}\s*/,
  /^PAGSERV\s*/,
  /^TRF\.? MB ?WAY P\/O?\s*/,
  /^TRF\.? P\/O?\s*/,
  /^TRF\.? DE\s*/,
  /^TRANSF IMED DE\s*/,
  /^TRF IMEDIATA P\/\s*/,
  /\bCONTACTLESS\b/g,
  /\b\d{4}-\d{3}\b/g, // postal codes
];

/** The part of a description that identifies the merchant. */
export function merchantText(desc: string): string {
  let s = norm(desc);
  for (const re of NOISE) s = s.replace(re, ' ').trim();
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Default rule pattern suggested when you categorize a transaction:
 * the first word if it's distinctive (LIDL, CONTINENTE), else the first two (A CUNHA).
 */
export function suggestPattern(desc: string): string {
  const words = merchantText(desc)
    .split(' ')
    .filter((w) => /[A-Z]/.test(w));
  if (!words.length) return norm(desc);
  // Transfers to people: one first name is too broad, use two.
  if (/^(TRF|TRANSF)/.test(norm(desc))) return words.slice(0, 2).join(' ');
  // Motorway tolls (A1, A8, A41...)
  if (/^A\d+$/.test(words[0])) return words[0];
  if (words[0].length >= 4) return words[0];
  return words.slice(0, 2).join(' ');
}

/** Whole-word substring match on normalized text ("LIDL" matches "COMPRA LIDL AMADORA", not "LIDLX"). */
export function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    const before = haystack[i - 1];
    const after = haystack[i + needle.length];
    if ((!before || !/[A-Z0-9]/.test(before)) && (!after || !/[A-Z0-9]/.test(after))) return true;
    i = haystack.indexOf(needle, i + 1);
  }
  return false;
}

export const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
export const fmt = (n: number) => eur.format(n);

export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** "COMPRA 7782 LIDL AGRADECE AMADORA CONTACTLESS" → "Lidl Agradece Amadora" */
export function pretty(desc: string): string {
  const m = merchantText(desc) || norm(desc);
  return m
    .toLowerCase()
    .replace(/(^|[\s/(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}
