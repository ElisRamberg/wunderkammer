// ── Number formatting helpers ────────────────────────────────────────────────

const fmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatInt(n) {
  return Number.isFinite(n) ? fmtInt.format(Math.round(n)) : "—";
}

export function formatNum(n, d = 1) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n);
}

// Punchy, headline-friendly count, e.g. "2.48 million" / "1.3 billion".
// Below a million we keep the exact comma figure — it's still readable big.
export function formatHuman(n) {
  if (!Number.isFinite(n)) return "—";
  n = Math.round(n);
  if (n >= 1e9) return `${formatNum(n / 1e9, 2)} billion`;
  if (n >= 1e6) return `${formatNum(n / 1e6, 2)} million`;
  return formatInt(n);
}
