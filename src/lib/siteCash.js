// siteCash.js — one place for turning closed-loop points into the dollar "Site Cash" the user sees.
//
// Points are worth 1¢ each (POINT_VALUE_CENTS). Site Cash is that value shown as dollars: it feels like
// money and spends like money ON THIS SITE, but it is NON-WITHDRAWABLE — it never converts to bank cash,
// a debit card, or a P2P app. That's what keeps the platform a closed-loop rewards store (Kohl's-Cash
// style) rather than a money transmitter.

export const CENTS_PER_POINT = 1;
export const SITE_CASH_LABEL = 'Site Cash';
export const SITE_CASH_NOTE = 'Spends only on this site — not withdrawable to a bank or Cash App.';

/** Points → dollars (number). */
export function pointsToCash(points) {
  return (Math.max(0, Number(points) || 0) * CENTS_PER_POINT) / 100;
}

/** Dollars → points (integer). */
export function cashToPoints(usd) {
  return Math.round((Math.max(0, Number(usd) || 0) * 100) / CENTS_PER_POINT);
}

/** Format a dollar amount as "$1,234.56". */
export function formatCash(usd) {
  return `$${(Math.max(0, Number(usd) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a points balance directly as Site Cash dollars. */
export function pointsAsCash(points) {
  return formatCash(pointsToCash(points));
}
