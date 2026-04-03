
export interface Node {
  id: string;
  x: number;
  y: number;
  size: number;
  type: 'HUB' | 'SATELLITE';
  label: string;
  riskScore: number;
  exposure?: string; // e.g., "R$ 2.4M"
}

export interface ChartDataPoint {
  day: number;
  mfsProb: number;
  tradProb: number;
}

export interface InsightCard {
  id: string;
  title: string;
  impact: 'High' | 'Medium' | 'Low';
  value: number; // Percentage
  type: 'topology' | 'sector' | 'history';
}
