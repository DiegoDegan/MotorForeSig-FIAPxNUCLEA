import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell,
} from 'recharts';
import { BentoCell, TopNav } from '../../components/shared';
import { getPDSummary, PDSummary } from '../../services/api';
import { ShieldAlert, TrendingDown, AlertTriangle } from 'lucide-react';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TOOLTIP_STYLE = { backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '11px', color: '#fff' };

// cores por faixa de risco de score — gradiente vermelho → mint (10 buckets de 100 pts)
const FAIXA_COLORS: Record<string, string> = {
  '0–100':    '#ff7162',
  '101–200':  '#ff8c70',
  '201–300':  '#f97316',
  '301–400':  '#fb923c',
  '401–500':  '#fee440',
  '501–600':  '#facc15',
  '601–700':  '#a3e635',
  '701–800':  '#c3f400',
  '801–900':  '#4ade80',
  '901–1000': '#73f3c7',
};

// cor do ponto scatter por PD
const pdColor = (pd: number) =>
  pd >= 0.55 ? '#ff7162' : pd >= 0.35 ? '#fee440' : pd >= 0.15 ? '#c3f400' : '#73f3c7';

// gradiente dinâmico para Risco por UF (Ciano -> Amarelo -> Vermelho)
const interpolateUfColor = (val: number, max: number) => {
  const pct = max > 0 ? Math.min(Math.max(val / max, 0), 1) : 0;
  if (pct < 0.5) {
     const p = pct * 2;
     const r = Math.round(115 + (254 - 115) * p);
     const g = Math.round(243 + (228 - 243) * p);
     const b = Math.round(199 + (64 - 199) * p);
     return `rgb(${r},${g},${b})`;
  } else {
     const p = (pct - 0.5) * 2;
     const r = Math.round(254 + (255 - 254) * p);
     const g = Math.round(228 + (113 - 228) * p);
     const b = Math.round(64 + (98 - 64) * p);
     return `rgb(${r},${g},${b})`;
  }
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export const PDPerdaEstimadaScreen = () => {
  const [data, setData] = useState<PDSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await getPDSummary();
      if (result) setData(result);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="text-white p-8 font-mono animate-pulse uppercase tracking-widest">
      CARREGANDO PD & PERDA ESTIMADA...
    </div>
  );
  if (!data) return (
    <div className="text-heat p-8 font-mono border border-heat/30 rounded-lg bg-heat/5">
      ERRO AO CARREGAR DADOS DE PD/EL.
    </div>
  );

  const maxElUf = Math.max(...data.el_por_uf.map(d => d.el), 0);

  return (
    <>
      <TopNav title="PD & PERDA ESTIMADA" subtitle="PREVISÃO DE DEFAULT E PERDA ESPERADA (EL)" />

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <BentoCell 
          title="Provisão Total — EL Σ(PD × LGD × EAD)" 
          icon={ShieldAlert}
          tooltip="Soma total da Perda Esperada (Expected Loss), calculada multiplicando a Probabilidade de Default (PD) pela Perda em caso de Default (LGD) e pela Exposição no momento do Default (EAD)."
        >
          <div className="mt-2">
            <span className="text-xl font-mono font-bold text-heat tracking-tighter">
              {fmtCompact(data.el_total)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Perda esperada total da carteira
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="PD (Inadimplência) Média da Carteira" 
          icon={TrendingDown}
          tooltip="Média ponderada da Probabilidade de Default de todos os pagadores ativos na carteira."
        >
          <div className="mt-2">
            <span className="text-xl font-mono font-bold text-white tracking-tighter">
              {fmtPct(data.pd_media)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Probabilidade de default média
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Provisão Sugerida (EL + 20% buffer)" 
          icon={AlertTriangle}
          tooltip="Valor recomendado para reserva de capital, incluindo a EL total somada a uma margem de segurança (buffer) de 20% para cobrir variações estatísticas."
        >
          <div className="mt-2">
            <span className="text-xl font-mono font-bold text-heat tracking-tighter">
              {fmtCompact(data.provisao_sugerida)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Reserva recomendada para perdas
            </div>
          </div>
        </BentoCell>

      </div>

      {/* ── Grade 2×2 — cruz central separando os 4 gráficos ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ① EL por Faixa de Score ─────────────────────────────────── */}
        <BentoCell
          title="EL (Perda Esperada) por Faixa de Score"
          tooltip="Perda esperada acumulada agrupada por bucket de score_materialidade_v2. Buckets de menor score concentram maior risco individual, porém menor volume de boletos."
          className="h-[380px] flex flex-col"
        >
          <p className="text-[10px] font-mono text-white/30 -mt-3 mb-3">
            Σ EL = PD × LGD × vlr_nominal · agrupado por faixa de score_materialidade_v2
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.el_por_faixa} margin={{ left: 0, right: 16, top: 4, bottom: 36 }} barCategoryGap="19%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="faixa"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#73f3c7' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number, _name: string, props: any) => [
                    fmtCompact(value),
                    `EL · PD média ${fmtPct(props.payload.pd_media)} · ${props.payload.count} boletos`,
                  ]}
                  labelFormatter={l => `Score ${l}`}
                />
                <Bar dataKey="el" radius={[4, 4, 0, 0]}>
                  {data.el_por_faixa.map((entry) => (
                    <Cell key={entry.faixa} fill={FAIXA_COLORS[entry.faixa] ?? '#73f3c7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* legenda faixas */}
          <div className="flex gap-3 flex-wrap mt-3">
            {data.el_por_faixa.map(e => (
              <div key={e.faixa} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: FAIXA_COLORS[e.faixa] }} />
                <span className="text-[10px] font-mono text-white/40">{e.faixa}</span>
              </div>
            ))}
          </div>
        </BentoCell>

        {/* ② Scatter — Exposição vs PD ─────────────────────────────── */}
        <BentoCell
          title="Dispersão — Exposição vs PD (Inadimplência)"
          tooltip="Cada ponto é um pagador. Quadrante superior-direito = maior exposição E maior PD = Top Risks. Cor: verde=baixo risco, vermelho=crítico."
          className="h-[380px] flex flex-col"
        >
          <p className="text-[10px] font-mono text-white/30 -mt-3 mb-3">
            apenas empresas com PD &gt; 5% ou exposição &gt; R$ 50k
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: -10, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  type="number"
                  dataKey="exposicao"
                  name="Exposição"
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  label={{ value: 'Exposição', position: 'insideBottomRight', offset: -8,
                           fill: 'rgba(255,255,255,0.2)', fontSize: 14, fontFamily: 'monospace' }}
                />
                <YAxis
                  type="number"
                  dataKey="pd"
                  name="PD"
                  domain={[0, 1]}
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#73f3c7' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: '4px' }}
                  cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }}
                  formatter={(value: number, name: string) =>
                    name === 'Exposição' ? [fmtCompact(value), 'Exposição'] : [fmtPct(value), 'PD']
                  }
                />
                <Scatter data={data.scatter_data} isAnimationActive={false}>
                  {data.scatter_data.map((entry, i) => (
                    <Cell key={i} fill={pdColor(entry.pd)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-2">
            {[['#73f3c7','≤5%'],['#c3f400','≤15%'],['#fee440','≤35%'],['#ff7162','>35%']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c as string }} />
                <span className="text-[10px] font-mono text-white/40">PD {l}</span>
              </div>
            ))}
          </div>
        </BentoCell>

        {/* ③ Risco por UF ──────────────────────────────────────────── */}
        <BentoCell
          title="Risco por UF — EL (Perda Esperada) por Estado"
          tooltip="Distribuição geográfica da perda esperada. Estados com alta concentração de boletos de baixo score acumulam maior EL proporcional."
          className="h-[380px] flex flex-col"
        >
          <p className="text-[10px] font-mono text-white/30 -mt-3 mb-3">
            Σ EL por UF do pagador · barras verticais ordenadas por valor
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.el_por_uf}
                margin={{ left: 0, right: 8, top: 4, bottom: 32 }}
                barCategoryGap="19%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="uf"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#73f3c7' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number, _name: string, props: any) => [
                    fmtCompact(value),
                    `EL · PD média ${fmtPct(props.payload.pd_media)} · ${props.payload.count} boletos`,
                  ]}
                  labelFormatter={l => `UF: ${l}`}
                />
                <Bar dataKey="el" radius={[4, 4, 0, 0]} opacity={0.85}>
                  {data.el_por_uf.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={interpolateUfColor(entry.el, maxElUf)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        {/* ④ Histograma de Score ───────────────────────────────────── */}
        <BentoCell
          title="Rating de Qualidade do Lastro (MFS)"
          tooltip="Frequência de boletos por faixa de score_materialidade_v2 (0–1000). Concentração à direita indica carteira saudável; picos à esquerda sinalizam risco elevado."
          className="h-[380px] flex flex-col"
        >
          <p className="text-[10px] font-mono text-white/30 -mt-3 mb-3">
            Nº de boletos por faixa de score · quanto mais à direita, menor o risco
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.el_por_faixa}
                margin={{ left: 0, right: 8, top: 4, bottom: 36 }}
                barCategoryGap="19%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="faixa"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  label={{ value: 'Nº boletos', angle: -90, position: 'insideLeft', offset: 12,
                           fill: 'rgba(255,255,255,0.2)', fontSize: 14, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#73f3c7' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value.toLocaleString('pt-BR')} boletos`,
                    `PD média ${fmtPct(props.payload.pd_media)}`,
                  ]}
                  labelFormatter={l => `Score ${l}`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.el_por_faixa.map((entry) => (
                    <Cell key={entry.faixa} fill={FAIXA_COLORS[entry.faixa] ?? '#73f3c7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* mini-legenda de risco */}
          <div className="flex justify-between mt-2 text-[10px] font-mono text-white/30">
            <span style={{ color: FAIXA_COLORS['0–200'] }}>← Alto Risco</span>
            <span style={{ color: FAIXA_COLORS['801–1000'] }}>Baixo Risco →</span>
          </div>
        </BentoCell>

      </div>
    </>
  );
};
