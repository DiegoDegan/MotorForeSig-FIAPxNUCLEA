import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, BarChart, Legend
} from 'recharts';
import { BentoCell, TopNav } from '../../components/shared';
import { getPortfolioSummary, getCreditPipeline, PortfolioSummary, PipelineOperation } from '../../services/api';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(val);

const truncate = (s: string, n = 13) => s.length > n ? s.slice(0, n) + '…' : s;

// ─── KPI card compacto ───────────────────────────────────────────────────────
const KpiCard = ({
  title, value, sub, status = 'mint',
}: { title: string; value: string; sub: string; status?: 'mint' | 'lime' | 'heat' }) => {
  const col = { mint: 'text-mint', lime: 'text-lime', heat: 'text-heat' }[status];
  return (
    <BentoCell title={title} status={status}>
      <div className="mt-2">
        <span className={`text-3xl font-mono font-bold tracking-tighter ${col}`}>{value}</span>
        <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">{sub}</div>
      </div>
    </BentoCell>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
export const ConcentracaoScreen = () => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [pipeline, setPipeline] = useState<PipelineOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [sum, pip] = await Promise.all([getPortfolioSummary(), getCreditPipeline()]);
      if (sum) setSummary(sum);
      if (pip) setPipeline(pip as PipelineOperation[]);
      setLoading(false);
    })();
  }, []);

  // ── Cálculos derivados ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!summary) return null;

    const totalSector = summary.cnae_data.reduce((a, v) => a + v, 0) || 1;

    // Pareto por setor (barras + linha cumulativa)
    let cum = 0;
    const paretoData = summary.cnae_labels.map((label, i) => {
      cum += summary.cnae_data[i];
      return {
        setor: truncate(label),
        exposicao: summary.cnae_data[i],
        acumulado: (cum / totalSector) * 100,
      };
    });

    // Cedentes aggregados do pipeline
    const cedMap: Record<string, number> = {};
    pipeline.forEach(op => {
      cedMap[op.cedente] = (cedMap[op.cedente] ?? 0) + op.valor_nominal;
    });
    const cedTotal = Object.values(cedMap).reduce((a, v) => a + v, 0) || 1;

    let cedCum = 0;
    const cedParetoData = Object.entries(cedMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ced, val]) => {
        cedCum += val;
        return {
          cedente: truncate(ced, 15),
          exposicao: val,
          acumulado: (cedCum / cedTotal) * 100,
        };
      });

    // Risco por setor (bar duplo: exposição + EL estimado)
    const riskBySetor = summary.cnae_labels.slice(0, 8).map((label, i) => ({
      setor: truncate(label, 14),
      exposicao: summary.cnae_data[i],
      el_estimado: summary.cnae_data[i] * (summary.el_sum / (summary.total_exposed_value || 1)),
    }));

    return { paretoData, cedParetoData, riskBySetor, cedTotal };
  }, [summary, pipeline]);

  if (loading) return (
    <div className="text-white p-8 font-mono animate-pulse uppercase tracking-widest">
      CARREGANDO ANÁLISE DE CONCENTRAÇÃO...
    </div>
  );
  if (!summary || !metrics) return (
    <div className="text-heat p-8 font-mono border border-heat/30 rounded-lg bg-heat/5">
      ERRO AO CARREGAR DADOS DE CONCENTRAÇÃO.
    </div>
  );

  const hhiStatus  = metrics.hhi < 1_500 ? 'Desconcentrado' : metrics.hhi < 2_500 ? 'Moderado' : 'Concentrado';
  const hhiColor   = metrics.hhi < 1_500 ? 'mint' : metrics.hhi < 2_500 ? 'lime' : 'heat';

  const tooltipStyle = { backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '11px' };

  return (
    <>
      <TopNav title="CONCENTRAÇÃO" subtitle="RISCO DE CONTRAPARTE / COUNTERPARTY RISK" />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BentoCell 
          title="Índice HHI (Concentração Setorial)" 
          tooltip="Índice Herfindahl-Hirschman: mede a concentração de mercado. Valores altos indicam dependência excessiva de poucos setores."
        >
          <div className="mt-2">
            <span className={`text-3xl font-mono font-bold tracking-tighter ${summary.hhi_setorial < 1500 ? 'text-mint' : summary.hhi_setorial < 2500 ? 'text-lime' : 'text-heat'}`}>
              {summary.hhi_setorial.toFixed(0)}
            </span>
            <span className={`text-sm font-mono ml-2 ${summary.hhi_setorial < 1500 ? 'text-mint' : summary.hhi_setorial < 2500 ? 'text-lime' : 'text-heat'}`}>
              {summary.hhi_setorial < 1500 ? 'Saudável' : summary.hhi_setorial < 2500 ? 'Moderado' : 'Concentrado'}
            </span>
            <div className="text-xs font-mono text-white/40 mt-2 uppercase tracking-widest leading-relaxed">
              &lt;1 500 = Saudável · 1 500–2 500 = Alerta · &gt;2 500 = Crítico
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Concentração Top 5 Pagadores"
          tooltip="Representatividade dos 5 maiores pagadores (sacados) no volume total da carteira."
        >
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold tracking-tighter text-white">
              {summary.top_pagadores_pareto.slice(0, 5).reduce((a, b) => a + b.acumulado_pct, 0).toFixed(1)}%
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              exposição total nos 5 maiores sacados
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Atraso Médio da Carteira"
          tooltip="Prazo médio de atraso ponderado pelo volume, indicando a pontualidade geral da rede."
        >
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold tracking-tighter text-mint">
              {summary.avg_delay} dias
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              expectativa média de liquidação
            </div>
          </div>
        </BentoCell>
      </div>

      {/* ── Linha 1: Pareto Setor + Pareto Cedentes ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Pareto por Pagador (Sacado) — ALINHADO AO PLANEJAMENTO TELA 5 */}
        <BentoCell 
          title="Pareto de Pagadores (Concentração Sacados)" 
          tooltip="Análise de Pareto para identificar dependência de sacados específicos. Idealmente, 80% da carteira deve ser distribuída entre muitos pagadores."
          className="h-[400px] flex flex-col"
        >
          <p className="text-sm font-mono text-white/30 -mt-3 mb-2">top 10 sacados por volume · linha = % acumulado</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={summary.top_pagadores_pareto} margin={{ left: -10, right: 24, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="id"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis yAxisId="left" hide />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'monospace' }}
                  tickFormatter={v => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: string) =>
                    name === 'acumulado_pct'
                      ? [`${Number(value).toFixed(1)}%`, 'Acumulado']
                      : [formatCurrency(value), 'Exposição']
                  }
                  labelFormatter={v => `Sacado ID: ${v}`}
                />
                <Bar yAxisId="left" dataKey="valor" fill="#73f3c7" radius={[3, 3, 0, 0]} opacity={0.75} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="acumulado_pct"
                  stroke="#c3f400"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#c3f400' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        {/* Pareto por Setor */}
        <BentoCell 
          title="Pareto de Exposição por Setor (CNAE)" 
          tooltip="Mede o risco de concentração setorial. Diversificação entre setores reduz a vulnerabilidade a crises macroeconômicas específicas."
          className="h-[400px] flex flex-col"
        >
          <p className="text-sm font-mono text-white/30 -mt-3 mb-2">barras = volume · linha = % acumulado</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics.paretoData} margin={{ left: -10, right: 24, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="setor"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis yAxisId="left" hide />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'monospace' }}
                  tickFormatter={v => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: string) =>
                    name === 'acumulado'
                      ? [`${Number(value).toFixed(1)}%`, 'Acumulado']
                      : [formatCurrency(value), 'Exposição']
                  }
                />
                <Bar yAxisId="left" dataKey="exposicao" fill="#9b5de5" radius={[3, 3, 0, 0]} opacity={0.75} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#fee440"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#fee440' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>
      </div>

      {/* ── Linha 2: Liquidez + UF + Maiores Cedentes ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Liquidez por Setor */}
        <BentoCell 
          title="Liquidez por Setor (Indicador 1M)" 
          tooltip="Média do índice de liquidez por setor CNAE. Identifica quais setores estão convertendo vendas em caixa com maior rapidez."
          className="h-[320px] flex flex-col"
        >
          <div className="flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.liquidez_por_setor} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" domain={[0, 1]} hide />
                <YAxis
                  dataKey="setor"
                  type="category"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [Number(value).toFixed(3), 'Índice de Liquidez']}
                />
                <Bar dataKey="liquidez" fill="#c3f400" radius={[0, 3, 3, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        <BentoCell
          title="Concentração por UF"
          tooltip="Volume financeiro total alocado por estado (UF) do pagador. Ajuda a identificar riscos geográficos isolados."
          className="h-[320px] flex flex-col"
        >
          <div className="flex-1 mt-2">
            {summary.exposicao_por_uf && summary.exposicao_por_uf.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.exposicao_por_uf} margin={{ left: 0, right: 8, top: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="uf"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => formatCurrency(v)}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Exposição']}
                  />
                  <Bar dataKey="valor" fill="#73f3c7" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs font-mono text-white/20 uppercase">
                Sem dados de UF disponíveis
              </div>
            )}
          </div>
        </BentoCell>

        {/* Maiores Exposições */}
        <BentoCell 
          title="Top 10 Maiores Exposições" 
          tooltip="Ranking das entidades com maior volume financeiro alocado na carteira."
          className="h-[320px] flex flex-col"
        >
          <div className="flex-1 mt-4 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {summary.top_exposures.map((item, i) => {
              const topTotal = summary.top_exposures.reduce((a, e) => a + Number(e.exposure), 0) || 1;
              const pct = (Number(item.exposure) / topTotal) * 100;
              const barColor = i === 0 ? '#ff7162' : i < 3 ? '#c3f400' : '#73f3c7';

              return (
                <div key={i}>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white/25 w-3 text-right">{i + 1}</span>
                      <span className="text-white font-bold">{item.entity}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          item.risk === 'ALTO'
                            ? 'text-heat border-heat/30 bg-heat/10'
                            : 'text-mint border-mint/30 bg-mint/10'
                        }`}
                      >
                        {item.risk}
                      </span>
                    </div>
                    <span className="text-white/60 tabular-nums">{formatCurrency(Number(item.exposure))}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        boxShadow: `0 0 6px ${barColor}55`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCell>
      </div>
    </>
  );
};
