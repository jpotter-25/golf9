const compactUnits = [
  { value: 1e15, suffix: 'Q' },
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];

/** Keep ordinary balances exact; compact large ones without overstating funds. */
export function formatCoinBalance(coins: number): { display: string; exact: string } {
  if (!Number.isSafeInteger(coins) || coins < 0) {
    return { display: '—', exact: 'unavailable' };
  }

  const exact = String(coins).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (coins < 100_000) return { display: exact, exact };

  const unit = compactUnits.find(candidate => coins >= candidate.value)!;
  const whole = Math.floor(coins / unit.value);
  const decimals = whole >= 100 ? 0 : whole >= 10 ? 1 : 2;
  const scale = 10 ** decimals;
  // Integer steps avoid rounding 999,999 up to an unearned million.
  const compact = Math.floor(coins / (unit.value / scale)) / scale;
  return { display: `${compact}${unit.suffix}`, exact };
}
