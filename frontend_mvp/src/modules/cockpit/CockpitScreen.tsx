import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, PieChart as PieIcon, BarChart3, TrendingDown, Target, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BentoCell, TopNav } from '../../components/shared';
import { getPortfolioSummary, PortfolioSummary } from '../../services/api';

const COLORS = ['#00f5d4', '#fee440', '#f15bb5', '#9b5de5', '#00BBF9'];
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(val);
const formatCurrencyFull = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const CockpitScreen = () => {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskBand, setRiskBand] = useState<string>("GERAL");

  const fetchData = async (band?: string) => {
    setLoading(true);
    const apiBand = band === "GERAL" ? undefined : band;
    const result = await getPortfolioSummary(apiBand);
    if (result) setData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchData(riskBand);
  }, [riskBand]);

  if (loading && !data) return <div className="text-white p-8 font-mono animate-pulse">CARREGANDO DADOS EXECUTIVOS...</div>;
  if (!data) return <div className="text-heat p-8 font-mono border border-heat/30 rounded-lg bg-heat/5">ERRO AO CARREGAR COCKPIT. VERIFIQUE A CONEXÃO COM A API.</div>;

  const rejectionPieData = data.rejection_labels.map((label, i) => ({
    name: label,
    value: data.rejection_data[i]
  }));

  const totalRejections = data.rejection_data.reduce((acc, curr) => acc + curr, 0);

  const cnaeBarData = data.cnae_labels.map((label, i) => ({
    name: label,
    value: data.cnae_data[i]
  }));

  const getRiskColor = (band: string) => {
    if (band === "BAIXO") return "text-mint";
    if (band === "MODERADO") return "text-lime";
    if (band === "ALTO") return "text-heat";
    return "text-white";
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <TopNav title="COCKPIT GERENCIAL" subtitle="INDICADORES DE NEGÓCIO E CONCENTRAÇÃO DE RISCO" />

        <div className="flex bg-obsidian/50 p-1 rounded-xl border border-white/10 glass">
          {["GERAL", "BAIXO", "MODERADO", "ALTO"].map((band) => (
            <button
              key={band}
              onClick={() => setRiskBand(band)}
              className={`px-4 py-2 text-[10px] font-display font-bold tracking-widest rounded-lg transition-all ${riskBand === band
                  ? "bg-white text-obsidian shadow-lg"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
                }`}
            >
              {band}
            </button>
          ))}
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BentoCell title="Exposição Total" status="mint" icon={ShieldCheck}>
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {formatCurrency(data.total_exposed_value)}
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Patrimônio em Operação</div>
          </div>
        </BentoCell>

        <BentoCell title="Prazo Médio (Atraso)" status="lime" icon={TrendingDown}>
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {data.avg_delay} <span className="text-sm">DIAS</span>
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Expectativa de Liquidação</div>
          </div>
        </BentoCell>

        <BentoCell title="Liquidez Média" status="mint" icon={Target}>
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {(data.avg_liquidity * 100).toFixed(1)}%
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Capacidade Solvência Sacados</div>
          </div>
        </BentoCell>

        <BentoCell title="Perda Estimada (EL)" status="heat" icon={ShieldAlert}>
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-heat text-glow-heat tracking-tighter">
              {formatCurrency(data.el_sum)}
            </span>
            <div className="text-[10px] font-mono text-heat/50 mt-1 uppercase tracking-widest">Provisão Teórica de Risco</div>
          </div>
        </BentoCell>
      </div>

      {/* MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* REJECTIONS PIE */}
        <BentoCell title="Motivos de Rejeição" className="col-span-1 h-[380px] flex flex-col">
          <div className="flex-1 mt-4 relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-10px]">
              <span className="text-3xl font-mono font-bold text-white leading-none">{totalRejections}</span>
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">Total</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rejectionPieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {rejectionPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ fontFamily: 'monospace' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-4">
            {rejectionPieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[9px] font-mono text-white/60 truncate" title={entry.name}>
                  {entry.name}: <span className="text-white/40">{entry.value}</span>
                </span>
              </div>
            ))}
          </div>
        </BentoCell>

        {/* CNAE BAR */}
        <BentoCell title="Principais Setores (Exposição)" className="col-span-1 h-[380px] flex flex-col">
          <div className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cnaeBarData} layout="vertical" margin={{ left: -10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }} width={120} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [formatCurrency(value), "Valor"]}
                />
                <Bar dataKey="value" fill="#00f5d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-[10px] font-mono text-white/30 italic">DISTRIBUIÇÃO DE VOLUME FINANCEIRO (BRL)</div>
        </BentoCell>

        {/* TOP EXPOSURES & ACTION SIDEBAR */}
        <div className="col-span-1 flex flex-col gap-4">
          <BentoCell title="Principais Exposições" className="flex-1">
            <div className="space-y-4 mt-4">
              {data.top_exposures.map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <div>
                    <div className="text-[11px] font-mono font-bold text-white">{item.entity}</div>
                    <div className={`text-[9px] font-mono font-bold ${item.color}`}>{item.risk}</div>
                  </div>
                  <div className="text-[12px] font-mono text-white/80">{formatCurrencyFull(Number(item.exposure))}</div>
                </div>
              ))}
            </div>
          </BentoCell>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 flex flex-col relative overflow-hidden glass">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-mint animate-pulse" />
              <h3 className="text-[10px] font-display font-bold text-white/80 tracking-widest uppercase">Inteligência Prescritiva</h3>
            </div>
            <div className="space-y-3">
              {data.recommended_actions.map((action, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-mint mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-white/70 font-display leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER HIDDEN METRICS (As per requested: "deixe eles ocultos") */}
      <div className="bg-obsidian/40 border border-white/5 rounded-lg p-4 flex justify-between items-center opacity-30 mt-8 mb-4 grayscale pointer-events-none">
        <div className="flex items-center gap-8">
          <div className="text-[9px] font-mono">PSI GLOBAL: {data.psi_global}</div>
          <div className="text-[9px] font-mono">ALERTAS DE DRIFT: {data.drift_alerts}</div>
          <div className="text-[9px] font-mono">STATUS DO MODELO: ESTÁVEL</div>
        </div>
        <div className="text-[9px] font-mono">METADADOS ML PROTEGIDOS</div>
      </div>
    </>
  );
};
