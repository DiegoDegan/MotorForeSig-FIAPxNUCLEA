import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  Treemap, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { BentoCell, TopNav } from '../../components/shared';
import { getPortfolioSummary, PortfolioSummary } from '../../services/api';
import { ShieldCheck, ShieldAlert, TrendingDown, Users } from 'lucide-react';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ─── Cores ───────────────────────────────────────────────────────────────────
const TREEMAP_COLORS = [
  '#73f3c7', '#c3f400', '#00BBF9', '#9b5de5',
  '#fee440', '#f15bb5', '#ff7162', '#00f5d4',
  '#adb5bd', '#4cc9f0',
];

const STATUS_COLORS = ['#73f3c7', '#c3f400', '#ff7162'];

// ─── Treemap Custom Cell ──────────────────────────────────────────────────────
const TreemapCell = (props: any) => {
  const { x, y, width, height, index, name, realValue, depth } = props;
  // Filtro de segurança: só renderiza o conteúdo se for um nó de dados (depth 1)
  // e se o valor real for um número válido. Isso evita o "R$ NaN" do nó raiz.
  if (depth !== 1 || width < 30 || height < 20 || isNaN(realValue)) return null;
  
  const color = TREEMAP_COLORS[index % TREEMAP_COLORS.length];
  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        style={{ fill: `${color}22`, stroke: color, strokeWidth: 1 }}
        rx={4}
      />
      {/* Reduzindo thresholds de visibilidade para aproveitar o redimensionamento */}
      {width > 45 && height > 30 && (
        <>
          {(() => {
            let nameParts = name.includes(' / ') ? name.split(' / ') : [name];
            // Se for apenas uma parte, mas tiver 2 palavras, quebra
            if (nameParts.length === 1 && name.trim().split(/\s+/).length === 2) {
              nameParts = name.trim().split(/\s+/);
            }
            
            const lineHeight = 14;
            return (
              <>
                {nameParts.map((part: string, i: number) => (
                  <text
                    key={i}
                    x={x + 8} y={y + 16 + (i * lineHeight)}
                    fill={color}
                    fontSize={11}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {part}
                  </text>
                ))}
                {height > (22 + nameParts.length * lineHeight) && (
                  <text
                    x={x + 8} y={y + 16 + (nameParts.length * lineHeight) + 2}
                    fill="rgba(255,255,255,0.5)"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {fmtCompact(realValue)}
                  </text>
                )}
              </>
            );
          })()}
        </>
      )}
    </g>
  );
};

// ─── Donut custom tooltip ─────────────────────────────────────────────────────
const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-obsidian border border-white/20 rounded px-3 py-2 font-mono text-xs">
      <div className="text-white/50 uppercase tracking-widest">{name}</div>
      <div className="text-white font-bold text-[13px]">{value.toLocaleString('pt-BR')}</div>
    </div>
  );
};

// ─── Gauge Materialidade ─────────────────────────────────────────────────────
const GaugeMaterialidade = ({ score, className = "" }: { score: number, className?: string }) => {
  const cx = 150, cy = 145, r = 105;

  const toPoint = (s: number, radius = r) => {
    const angle = (180 - (Math.max(0, Math.min(1000, s)) / 1000) * 180) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
  };

  const p0   = toPoint(0);
  const p300 = toPoint(300);
  const p700 = toPoint(700);
  const p1000 = toPoint(1000);
  const needle = toPoint(score, r * 0.82);
  const needleBase = toPoint(score, -12); // small tail

  const activeZ1End = Math.min(score, 300);
  const activeZ2End = Math.min(score, 700);
  const activeZ3End = Math.min(score, 1000);

  const zoneColor = score <= 300 ? '#ff7162' : score <= 700 ? '#c3f400' : '#73f3c7';
  const zoneName  = score <= 300 ? 'RISCO CRÍTICO' : score <= 700 ? 'ATENÇÃO' : 'SAUDÁVEL';

  const arcPath = (from: number, to: number) => {
    if (from >= to) return '';
    const a = toPoint(from);
    const b = toPoint(to);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  return (
    <BentoCell 
      title="Rating de Qualidade do Lastro (MFS)" 
      tooltip="Índice de saúde financeira da carteira baseado no cruzamento de dados de pagadores e base auxiliar."
      className={`flex flex-col ${className}`}
    >
      <p className="text-sm font-mono text-white/30 -mt-3 mb-1">
        score_materialidade_v2 médio
      </p>
      <svg viewBox="0 0 300 175" className="w-full" style={{ maxHeight: 240 }}>
        {/* ── Zonas de fundo (dimmed) ── */}
        <path d={`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p300.x.toFixed(2)} ${p300.y.toFixed(2)}`}
              fill="none" stroke="#ff716225" strokeWidth={18} strokeLinecap="butt" />
        <path d={`M ${p300.x.toFixed(2)} ${p300.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p700.x.toFixed(2)} ${p700.y.toFixed(2)}`}
              fill="none" stroke="#c3f40025" strokeWidth={18} strokeLinecap="butt" />
        <path d={`M ${p700.x.toFixed(2)} ${p700.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1000.x.toFixed(2)} ${p1000.y.toFixed(2)}`}
              fill="none" stroke="#73f3c725" strokeWidth={18} strokeLinecap="butt" />

        {/* ── Zonas ativas (preenchidas até o score) ── */}
        {score > 0   && <path d={arcPath(0,   activeZ1End)} fill="none" stroke="#ff7162" strokeWidth={18} strokeLinecap="butt" />}
        {score > 300 && <path d={arcPath(300, activeZ2End)} fill="none" stroke="#c3f400" strokeWidth={18} strokeLinecap="butt" />}
        {score > 700 && <path d={arcPath(700, activeZ3End)} fill="none" stroke="#73f3c7" strokeWidth={18} strokeLinecap="butt" />}

        {/* ── Marcadores de zona ── */}
        {[0, 300, 700, 1000].map(s => {
          const pt = toPoint(s, r + 14);
          return (
            <text key={s} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,255,255,0.35)" fontSize={8} fontFamily="monospace">
              {s}
            </text>
          );
        })}

        {/* ── Rótulos de zona ── */}
        {[
          { s: 150, label: 'CRÍTICO', color: '#ff7162' },
          { s: 500, label: 'MÉDIO',   color: '#c3f400' },
          { s: 850, label: 'SAUDÁVEL',color: '#73f3c7' },
        ].map(({ s, label, color }) => {
          const pt = toPoint(s, r - 26);
          return (
            <text key={s} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
                  fill={color} fontSize={7} fontFamily="monospace" fontWeight="bold" opacity={0.7}>
              {label}
            </text>
          );
        })}

        {/* ── Agulha ── */}
        <line x1={needleBase.x.toFixed(2)} y1={needleBase.y.toFixed(2)}
              x2={needle.x.toFixed(2)}     y2={needle.y.toFixed(2)}
              stroke="white" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={7}  fill="#1a202c" stroke="white" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3}  fill="white" />

        {/* ── Score central ── */}
        <text x={cx} y={cy - 28} textAnchor="middle"
              fill="white" fontSize={36} fontFamily="monospace" fontWeight="bold">
          {score.toFixed(0)}
        </text>
        <text x={cx} y={cy - 12} textAnchor="middle"
              fill={zoneColor} fontSize={10} fontFamily="monospace" fontWeight="bold" letterSpacing={2}>
          {zoneName}
        </text>
      </svg>
    </BentoCell>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export const CockpitScreen = () => {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await getPortfolioSummary();
      if (result) setData(result);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="text-white p-8 font-mono animate-pulse uppercase tracking-widest">
      CARREGANDO VISÃO GERAL...
    </div>
  );
  if (!data) return (
    <div className="text-heat p-8 font-mono border border-heat/30 rounded-lg bg-heat/5">
      ERRO AO CARREGAR COCKPIT. VERIFIQUE A CONEXÃO COM A API.
    </div>
  );

  // Treemap data - usando escala de Raiz Quadrada para o tamanho (layout)
  // mas mantendo o valor real (realValue) para exibição e tooltip
  const treemapData = data.cnae_labels
    .map((name, i) => ({
      name,
      realValue: data.cnae_data[i],
      size: Math.sqrt(data.cnae_data[i]), 
    }))
    .filter(item => item.name && item.name.trim() !== "" && item.realValue > 0);

  // Donut data
  const statusData = data.status_labels.map((name, i) => ({
    name,
    value: data.status_data[i],
  }));
  const totalStatus = data.status_data.reduce((a, v) => a + v, 0) || 1;

  // Inadimplência color
  const inadColor = data.inadimplencia_pct > 30
    ? 'text-heat'
    : data.inadimplencia_pct > 15
    ? 'text-lime'
    : 'text-mint';

  return (
    <>
      <TopNav
        title="VISÃO GERAL"
        subtitle="PORTFOLIO HEALTH — SAÚDE DA CARTEIRA"
      />

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <BentoCell 
          title="VME — Volume Máximo Exposto" 
          icon={ShieldCheck}
          tooltip="Soma total do valor nominal de todos os boletos em aberto na carteira."
        >
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {fmtCompact(data.vme)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Boletos em aberto
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Ticket Médio por Boleto" 
          icon={TrendingDown}
          tooltip="Valor médio individual de cada boleto presente na carteira atual."
        >
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {fmtCompact(data.ticket_medio)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Valor nominal médio
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Inadimplência Real (D+1)" 
          icon={ShieldAlert}
          tooltip="Percentual de boletos que já venceram e ainda não foram liquidados até a data de processamento."
        >
          <div className="mt-2">
            <span className={`text-3xl font-mono font-bold tracking-tighter ${inadColor}`}>
              {fmtPct(data.inadimplencia_pct)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Boletos vencidos não pagos
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title="Volume de Baixa" 
          icon={Users}
          tooltip="Montante financeiro total que já foi efetivamente pago e baixado no sistema."
        >
          <div className="mt-2">
            <span className="text-3xl font-mono font-bold text-white tracking-tighter">
              {fmtCompact(data.volume_baixa)}
            </span>
            <div className="text-xs font-mono text-white/40 mt-1 uppercase tracking-widest">
              Total liquidado (vlr_baixa)
            </div>
          </div>
        </BentoCell>

      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* TreeMap — 3 cols */}
        <BentoCell
          title="Exposição Setorial e Capilaridade"
          tooltip="Visualização proporcional do volume financeiro alocado em cada setor da economia através do CNAE do pagador."
          className="col-span-1 lg:col-span-3 h-[460px] flex flex-col"
        >
          <p className="text-sm font-mono text-white/30 -mt-3 mb-3">
            volume financeiro (Σ vlr_nominal) por setor CNAE
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                content={<TreemapCell />}
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-obsidian border border-white/20 rounded px-3 py-2 font-mono text-xs">
                        <div className="text-white font-bold">{d.name}</div>
                        <div className="text-mint">{fmtCompact(d.realValue)}</div>
                      </div>
                    );
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        {/* Donut — 2 cols */}
        <BentoCell
          title="Composição de Adimplência Operacional"
          tooltip="Divisão quantitativa de boletos por sua situação atual (pago no prazo, atrasado, etc)."
          className="col-span-1 lg:col-span-2 h-[460px] flex flex-col"
        >
          <p className="text-sm font-mono text-white/30 -mt-3 mb-3">
            classificação por situação de liquidação
          </p>

          {/* Donut */}
          <div className="flex-1 relative">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-mono font-bold text-white leading-none">
                {totalStatus.toLocaleString('pt-BR')}
              </span>
              <span className="text-sm font-mono text-white/30 uppercase tracking-widest mt-1">
                boletos
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="48%"
                  innerRadius="52%"
                  outerRadius="72%"
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-3 pb-2">
            {statusData.map((entry, i) => {
              const pct = (entry.value / totalStatus) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                      <span className="text-white/70 uppercase tracking-wide">{entry.name}</span>
                    </div>
                    <span className="text-white font-bold tabular-nums">
                      {entry.value.toLocaleString('pt-BR')}
                      <span className="text-white/40 ml-1">({fmtPct(pct)})</span>
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sub-KPI: CNPJs Ativos */}
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
            <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
              CNPJs Ativos (pagadores + cedentes)
            </span>
            <span className="text-[18px] font-mono font-bold text-mint">
              {data.cnpjs_ativos.toLocaleString('pt-BR')}
            </span>
          </div>
        </BentoCell>

      </div>

      {/* ── Linha Inferior: Tendência (70%) + Gauge (30%) ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mt-6">
        
        {/* Tendência Mensal */}
        <BentoCell
          title="Sazonalidade e Performance de Liquidação"
          tooltip="Evolução temporal do volume financeiro liquidado, segregando pagamentos feitos no prazo vs atrasados."
          className="lg:col-span-7 h-[380px] flex flex-col"
        >
          <p className="text-sm font-mono text-white/30 -mt-3 mb-3">
            Σ vlr_nominal por mês de vencimento · apenas boletos pagos
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthly_chart.map(d => {
                  const [y, m] = d.mes.split('-');
                  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                  return {
                    ...d,
                    mesLabel: `${months[parseInt(m) - 1]}/${y.slice(2)}`,
                  };
                })}
                margin={{ left: 16, right: 8, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="mesLabel"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => fmtCompact(v)}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={75}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(value: number, name: string) => [
                    fmtCompact(value),
                    name === 'no_prazo' ? 'Pago no Prazo' : 'Pago com Atraso',
                  ]}
                  labelFormatter={label => `Mês: ${label}`}
                />
                <Legend
                  formatter={v => (
                    <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                      {v === 'no_prazo' ? 'No Prazo' : 'Com Atraso'}
                    </span>
                  )}
                />
                <Bar dataKey="no_prazo"   stackId="a" fill="#73f3c7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="com_atraso" stackId="a" fill="#ff7162" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        {/* Gauge de Materialidade */}
        <GaugeMaterialidade 
          score={data.score_materialidade_media} 
          className="lg:col-span-3 h-[380px]"
        />

      </div>

    </>
  );
};
