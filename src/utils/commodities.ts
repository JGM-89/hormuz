// Hormuz sensitivity: how much each commodity reacts to strait disruption (0-1)
export const HORMUZ_SENSITIVITY: Record<string, number> = {
  'BZ=F': 0.95,   // 27% of maritime crude transits Hormuz
  'CL=F': 0.70,   // US benchmark, correlated
  'NG=F': 0.30,   // US gas, less directly affected
  'TTF=F': 0.85,  // European gas, Qatar LNG reroutes
  'ALI=F': 0.15,  // ME production, but global supply chain
  'LNG': 0.90,    // 20% of global LNG through Hormuz
  'UREA': 0.60,   // 35% of global exports through Hormuz
  'NH3': 0.75,    // 20% of trade through Hormuz
};

export function getSeverity(changePercent: number): 'nominal' | 'warn' | 'crit' {
  const abs = Math.abs(changePercent);
  if (abs >= 5) return 'crit';
  if (abs >= 2) return 'warn';
  return 'nominal';
}

export function getSeverityColor(changePercent: number): string {
  const sev = getSeverity(changePercent);
  if (sev === 'crit') return '#ff1744';
  if (sev === 'warn') return '#ffab00';
  return '#00e676';
}

export function formatCommodityPrice(price: number, symbol: string): string {
  // Bulk commodities show no decimals
  if (['UREA', 'ALI=F', 'NH3'].includes(symbol)) {
    return price.toFixed(0);
  }
  return price.toFixed(2);
}

// Compute Hormuz Risk Premium: weighted average of commodity movements × sensitivity
export function computeRiskPremium(
  commodities: { changePercent: number; hormuzSensitivity: number; price: number; symbol: string }[],
): { dollarImpact: number; percentImpact: number } {
  if (commodities.length === 0) return { dollarImpact: 0, percentImpact: 0 };

  let weightedPct = 0;
  let totalWeight = 0;
  let brentPrice = 78;

  for (const c of commodities) {
    if (c.symbol === 'BZ=F') brentPrice = c.price;
    const weight = c.hormuzSensitivity;
    weightedPct += c.changePercent * weight;
    totalWeight += weight;
  }

  const percentImpact = totalWeight > 0 ? weightedPct / totalWeight : 0;
  const dollarImpact = (percentImpact / 100) * brentPrice;

  return {
    dollarImpact: Math.round(dollarImpact * 100) / 100,
    percentImpact: Math.round(percentImpact * 100) / 100,
  };
}
