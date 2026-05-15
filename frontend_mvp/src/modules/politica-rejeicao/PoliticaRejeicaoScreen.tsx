import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { BentoCell, TopNav } from '../../components/shared';
import { getPoliticaSummary, getCreditPipeline, getPipelineReport, PoliticaSummary, PipelineOperation, PipelineReportItem } from '../../services/api';
import { ShieldCheck, ShieldAlert, TrendingDown, AlertTriangle, SlidersHorizontal, RotateCcw, Download } from 'lucide-react';
import XLSXStyle from 'xlsx-js-style';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const TOOLTIP_STYLE = { backgroundColor: '#0b0e14', borderColor: '#333', borderRadius: '8px', fontSize: '11px' };

// ─── PD ↔ Score mapping ───────────────────────────────────────────────────────
// PD is deterministic from score bands; returns the minimum score to stay within max_pd
const pdToMinScore = (maxPdPct: number): number => {
  const pd = maxPdPct / 100;
  if (pd >= 0.75) return 0;
  if (pd >= 0.55) return 201;
  if (pd >= 0.35) return 401;
  if (pd >= 0.15) return 601;
  if (pd >= 0.05) return 801;
  return 1001;
};

// ─── PolicySlider ─────────────────────────────────────────────────────────────
const PolicySlider = ({
  label, value, min, max, step, display, color = '#73f3c7', hint, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; color?: string; hint: string; onChange: (v: number) => void;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-mono font-bold tabular-nums" style={{ color }}>{display}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 mb-2">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-150"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 1 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-obsidian shadow-lg transition-all duration-150"
          style={{ left: `calc(${pct}% - 6px)`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-white/20">
        <span>{min}{label.includes('Score') ? '' : '%'}</span>
        <span className="text-white/30">{hint}</span>
        <span>{max}{label.includes('Score') ? '' : '%'}</span>
      </div>
    </div>
  );
};

// ─── Heatmap ──────────────────────────────────────────────────────────────────
const heatColor = (rate: number) => {
  const r = rate < 0.5 ? Math.round(115 + (255 - 115) * rate * 2) : 255;
  const g = rate < 0.5
    ? Math.round(243 + (228 - 243) * rate * 2)
    : Math.round(228 - (228 - 113) * (rate - 0.5) * 2);
  const b = rate < 0.5 ? Math.round(199 + (64 - 199) * rate * 2) : Math.round(64 + (98 - 64) * (rate - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
};

// Parses "0–200" or "0-200" and returns the low end
const binLow = (s: string) => parseInt(s.split(/[–\-]/)[0], 10);

const DecisionHeatmap = ({ data, scoreBins, liqBins, effectiveScore, contagioRateThreshold }: {
  data: PoliticaSummary['heatmap_data'];
  scoreBins: string[];
  liqBins: string[];
  effectiveScore: number;
  contagioRateThreshold: number;
}) => {
  const lookup: Record<string, { default_rate: number; count: number; atraso_medio: number }> = {};
  data.forEach(d => { lookup[`${d.score_bin}__${d.liq_bin}`] = d; });

  return (
    <BentoCell
      title="Matriz de Underwriting e Assertividade"
      tooltip="Cor = taxa de inadimplência histórica. Células esmaecidas = bloqueadas pela régua de score. Células com borda laranja = zona de risco de contágio (default_rate acima da tolerância configurada)."
      className="h-[380px] flex flex-col"
    >
      <p className="text-[9px] font-mono text-white/30 -mt-3 mb-3">
        score_materialidade_v2 × índice_liquidez_1m ·{' '}
        <span style={{ color: '#73f3c7' }}>░ bloqueado</span>{' · '}
        <span style={{ color: '#ff7162' }}>▣ zona contágio</span>
      </p>
      <div className="flex-1 overflow-auto">
        <div className="flex">
          <div className="w-20 shrink-0" />
          {liqBins.map(lb => (
            <div key={lb} className="flex-1 text-center text-[8px] font-mono text-white/40 pb-1 min-w-[52px]">{lb}</div>
          ))}
        </div>

        {[...scoreBins].reverse().map((sb, rowIndex) => {
          const low = binLow(sb);
          const isBlocked = low < effectiveScore;
          return (
            <div key={sb} className="flex items-stretch mb-0.5">
              <div className="w-20 shrink-0 flex items-center">
                <span className={`text-[8px] font-mono text-right w-full pr-2 transition-colors ${isBlocked ? 'text-white/15' : 'text-white/40'}`}>
                  {sb}
                </span>
              </div>
              {liqBins.map(lb => {
                const cell = lookup[`${sb}__${lb}`];
                const rate = cell?.default_rate ?? 0;
                const cnt  = cell?.count ?? 0;
                const isContagioZone = !isBlocked && cnt > 0 && rate > contagioRateThreshold;
                return (
                  <div
                    key={lb}
                    className="flex-1 min-w-[52px] min-h-[38px] flex flex-col items-center justify-center rounded-sm mx-0.5 cursor-default group relative transition-all duration-200"
                    style={{
                      backgroundColor: cnt > 0 ? heatColor(rate) + (isBlocked ? '0d' : '33') : 'rgba(255,255,255,0.02)',
                      border: isContagioZone
                        ? '1.5px dashed rgba(255,113,98,0.7)'
                        : `1px solid ${cnt > 0 ? heatColor(rate) + (isBlocked ? '22' : '66') : 'rgba(255,255,255,0.04)'}`,
                      opacity: isBlocked ? 0.3 : 1,
                      boxShadow: isContagioZone ? '0 0 6px rgba(255,113,98,0.25) inset' : undefined,
                    }}
                  >
                    {cnt > 0 && !isBlocked && (
                      <>
                        <span className="text-[9px] font-mono font-bold" style={{ color: heatColor(rate) }}>
                          {(rate * 100).toFixed(0)}%
                        </span>
                        <span className="text-[7px] font-mono text-white/30">{cnt}blt</span>
                      </>
                    )}
                    {cnt > 0 && (
                      <div className={`absolute ${rowIndex === 0 ? 'top-full mt-1' : 'bottom-full mb-1'} left-1/2 -translate-x-1/2 z-50 bg-obsidian border border-white/20 px-2 py-1.5 rounded text-[9px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity`}>
                        <div className="text-white/50">Score {sb} · Liq {lb}</div>
                        <div style={{ color: heatColor(rate) }}>Inad: {(rate * 100).toFixed(1)}%</div>
                        <div className="text-white/40">{cnt} boletos</div>
                        {isBlocked && <div className="text-heat/70 mt-0.5 font-bold">BLOQUEADO PELA RÉGUA</div>}
                        {isContagioZone && <div className="text-heat/80 mt-0.5 font-bold">⚠ ZONA DE CONTÁGIO</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="flex items-center gap-2 mt-2 justify-center">
          <span className="text-[8px] font-mono" style={{ color: heatColor(0) }}>Baixo risco</span>
          <div className="h-2 w-24 rounded-full" style={{
            background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})`
          }} />
          <span className="text-[8px] font-mono" style={{ color: heatColor(1) }}>Alto risco</span>
          <span className="text-[8px] font-mono text-white/15 ml-4">░ bloqueado</span>
        </div>
      </div>
    </BentoCell>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

const decisaoLabel = (d: string) => {
  if (d === 'APROVADO_AUTO') return 'APROVADO';
  if (d === 'ANALISE_MESA')  return 'REVISÃO';
  return 'REPROVADO';
};

const isReprovado = (d: string) => d.startsWith('REPROVADO');

// ─── DecisionTable ─────────────────────────────────────────────────────────────
const DecisionTable = ({ data, policy }: { data: PipelineReportItem[], policy: any }) => {
  // Decisão simulada: apenas PD (contagio não disponível no pipeline_report completo)
  const processedData = useMemo(() =>
    data.map(op => ({
      ...op,
      decisao_sim: (op.score_pd * 100) > policy.maxPD ? 'BLOQUEADO' : 'APROVADO',
    })),
  [data, policy]);

  const handleExport = () => {
    const COLS = [
      'id_boleto', 'id_pagador', 'id_beneficiario', 'dt_emissao',
      'dt_vencimento', 'dt_pagamento', 'vlr_nominal', 'vlr_baixa',
      'tipo_baixa', 'tipo_especie', 'id_cnpj', 'cd_cnae_prin', 'uf',
      'sacado_indice_liquidez_1m', 'cedente_indice_liquidez_1m',
      'score_materialidade_evolucao', 'media_atraso_dias',
      'indicador_liquidez_quantitativo_3m', 'share_vl_inad_pag_bol_6_a_15d',
      'score_quantidade_v2', 'score_materialidade_v2',
      'atraso_previsto_dias',
      'PD', 'LGD', 'EL', 'STATUS_FINAL', 'MOTIVO_DECISAO',
    ];

    const rows = processedData.map(d => ({
      id_boleto:        d.id_boleto,
      id_pagador:       d.id_pagador,
      id_beneficiario:  d.id_beneficiario ?? null,
      dt_emissao:       d.dt_emissao ?? null,
      dt_vencimento:    d.dt_vencimento ?? null,
      dt_pagamento:     d.dt_pagamento ?? null,
      vlr_nominal:      d.vlr_nominal,
      vlr_baixa:        d.vlr_baixa ?? null,
      tipo_baixa:       d.tipo_baixa ?? null,
      tipo_especie:     d.tipo_especie ?? null,
      id_cnpj:          d.id_cnpj ?? null,
      cd_cnae_prin:     d.cd_cnae_prin ?? null,
      uf:               d.uf ?? null,
      sacado_indice_liquidez_1m:          d.sacado_indice_liquidez_1m ?? null,
      cedente_indice_liquidez_1m:         d.cedente_indice_liquidez_1m ?? null,
      score_materialidade_evolucao:       d.score_materialidade_evolucao ?? null,
      media_atraso_dias:                  d.media_atraso_dias ?? null,
      indicador_liquidez_quantitativo_3m: d.indicador_liquidez_quantitativo_3m ?? null,
      share_vl_inad_pag_bol_6_a_15d:     d.share_vl_inad_pag_bol_6_a_15d ?? null,
      score_quantidade_v2:    d.score_quantidade_v2 ?? null,
      score_materialidade_v2: d.score_materialidade_v2 ?? null,
      atraso_previsto_dias:   d.atraso_previsto_dias ?? null,
      PD:            d.PD,
      LGD:           d.LGD ?? null,
      EL:            d.EL,
      STATUS_FINAL:  d.STATUS_FINAL,
      MOTIVO_DECISAO: d.MOTIVO_DECISAO ?? null,
    }));

    const ws = XLSXStyle.utils.json_to_sheet(rows);

    const headerStyle = {
      font: { bold: true, color: { rgb: '1A202C' } },
      fill: { fgColor: { rgb: '73F3C7' } },
      alignment: { horizontal: 'center' },
    };
    COLS.forEach((_, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
      if (ws[addr]) ws[addr].s = headerStyle;
    });

    // Verde → aprovado | Amarelo → análise de mesa | Vermelho → reprovado
    rows.forEach((row, ri) => {
      const sf      = row.STATUS_FINAL ?? '';
      const blocked = sf.startsWith('REPROVADO');
      const review  = sf === 'ANALISE_MESA';
      const approved = sf === 'APROVADO_AUTO';

      const fill = blocked  ? { fgColor: { rgb: 'FFCCCC' } }   // vermelho claro
                 : review   ? { fgColor: { rgb: 'FFF9CC' } }   // amarelo claro
                 : approved ? { fgColor: { rgb: 'CCFFEE' } }   // verde claro (mint)
                 : null;

      if (!fill) return;

      COLS.forEach((_, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri + 1, c: ci });
        if (ws[addr]) ws[addr].s = { fill, font: { color: { rgb: '1A202C' } } };
      });
    });

    ws['!cols'] = [
      { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, // id_boleto, id_pagador, id_beneficiario, dt_emissao
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, // dt_vencimento, dt_pagamento, vlr_nominal, vlr_baixa
      { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 6 }, // tipo_baixa, tipo_especie, id_cnpj, cd_cnae, uf
      { wch: 26 }, { wch: 26 }, { wch: 26 }, { wch: 16 }, // sacado_liq, cedente_liq, score_mat_ev, media_atraso
      { wch: 32 }, { wch: 28 }, // indicador_liq_3m, share_inad
      { wch: 18 }, { wch: 20 }, // score_qtd_v2, score_mat_v2
      { wch: 20 }, // atraso_previsto_dias
      { wch: 10 }, { wch: 10 }, { wch: 14 }, // PD, LGD, EL
      { wch: 24 }, { wch: 60 }, // STATUS_FINAL, MOTIVO_DECISAO
    ];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Recomendacoes');
    XLSXStyle.writeFile(wb, `Politica_Rejeicao_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const PREVIEW = 20;

  return (
    <BentoCell
      title={`Decisão do Motor por Boleto — ${processedData.length} operações (amostra balanceada)`}
      tooltip="Listagem detalhada das operações processadas. Compara a recomendação original do Motor Nuclea com a nova simulação de política, destacando bloqueios por score ou PD."
      className="mt-6"
      extra={
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-[10px] font-mono bg-mint/10 text-mint border border-mint/20 hover:bg-mint hover:text-obsidian px-3 py-1.5 rounded transition-all"
        >
          <Download className="w-3.5 h-3.5" /> EXPORTAR .XLSX
        </button>
      }
    >
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[10px] font-mono text-left border-separate border-spacing-y-1">
          <thead>
            <tr className="text-white/30 uppercase tracking-widest text-[9px]">
              <th className="px-3 py-2 font-normal">id_boleto</th>
              <th className="px-3 py-2 font-normal">id_pagador</th>
              <th className="px-3 py-2 font-normal text-right">vlr_nominal</th>
              <th className="px-3 py-2 font-normal text-right">score_pd</th>
              <th className="px-3 py-2 font-normal text-right">el_perda</th>
              <th className="px-3 py-2 font-normal text-center">decisão motor</th>
              <th className="px-3 py-2 font-normal text-center">simulação política</th>
            </tr>
          </thead>
          <tbody>
            {processedData.slice(0, PREVIEW).map((row, i) => {
              const blocked = row.decisao_sim === 'BLOQUEADO';
              const review  = row.decisao === 'ANALISE_MESA' && row.decisao_sim === 'APROVADO';
              const rowBg   = blocked ? 'bg-heat/10' : review ? 'bg-lime/5' : 'bg-white/[0.03]';
              return (
                <tr key={i} className={`${rowBg} hover:brightness-110 transition-all`}>
                  <td className="px-3 py-2.5 rounded-l max-w-[120px] truncate text-white/40 font-mono">{row.id_boleto.slice(0, 16)}…</td>
                  <td className="px-3 py-2.5 max-w-[120px] truncate text-white/30">{row.id_pagador.slice(0, 16)}…</td>
                  <td className="px-3 py-2.5 text-right font-bold text-white/80">{fmtBRL(row.vlr_nominal)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={(row.score_pd * 100) > policy.maxPD ? 'text-heat font-bold' : 'text-mint'}>
                      {(row.score_pd * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-heat/70">{fmtBRL(row.perda_el)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      isReprovado(row.decisao)        ? 'bg-heat/20 text-heat border-heat/30' :
                      row.decisao === 'ANALISE_MESA'  ? 'bg-lime/20 text-lime border-lime/30' :
                                                        'bg-mint/10 text-mint border-mint/20'
                    }`}>{decisaoLabel(row.decisao)}</span>
                  </td>
                  <td className="px-3 py-2.5 rounded-r text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      row.decisao_sim === 'BLOQUEADO'
                        ? 'bg-heat/20 text-heat border-heat/30'
                        : 'bg-mint/10 text-mint border-mint/20'
                    }`}>{row.decisao_sim}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {processedData.length > PREVIEW && (
          <div className="text-center py-3 text-[9px] font-mono text-white/20 uppercase tracking-widest">
            Exibindo {PREVIEW} de {processedData.length} registros · exporte .xlsx para ver todos com cores por linha
          </div>
        )}
      </div>
    </BentoCell>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const DEFAULTS = { scoreMin: 400, maxPD: 70, contagioTol: 0 };

export const PoliticaRejeicaoScreen = () => {
  const [data, setData]           = useState<PoliticaSummary | null>(null);
  const [pipeline, setPipeline]   = useState<PipelineOperation[]>([]);
  const [reportData, setReport]   = useState<PipelineReportItem[]>([]);
  const [loading, setLoading]     = useState(true);

  // ── Policy sliders ──
  const [scoreMin, setScoreMin]       = useState(DEFAULTS.scoreMin);
  const [maxPD, setMaxPD]             = useState(DEFAULTS.maxPD);       // 5–90 as integer %
  const [contagioTol, setContagioTol] = useState(DEFAULTS.contagioTol); // 0–30 as integer %

  useEffect(() => {
    (async () => {
      const [result, pip, report] = await Promise.all([
        getPoliticaSummary(), getCreditPipeline(), getPipelineReport(),
      ]);
      if (result) setData(result);
      if (pip)    setPipeline(pip as PipelineOperation[]);
      if (report) setReport(report);
      setLoading(false);
    })();
  }, []);

  const isDefault = scoreMin === DEFAULTS.scoreMin && maxPD === DEFAULTS.maxPD && contagioTol === DEFAULTS.contagioTol;

  // ── Simulation ──
  const sim = useMemo(() => {
    if (!data) return null;

    // Effective score threshold: max of score slider and PD-equivalent score
    const pdScore = pdToMinScore(maxPD);
    const effectiveScore = Math.max(scoreMin, pdScore);

    // Find nearest impact_curve point
    const curvePoint = data.impact_curve.length
      ? data.impact_curve.reduce((prev, curr) =>
          Math.abs(curr.threshold - effectiveScore) < Math.abs(prev.threshold - effectiveScore) ? curr : prev
        )
      : null;

    // Baseline (policy atual = score 400)
    const basePoint = data.impact_curve.length
      ? data.impact_curve.reduce((prev, curr) =>
          Math.abs(curr.threshold - 400) < Math.abs(prev.threshold - 400) ? curr : prev
        )
      : null;

    // Contágio: usa contagio_curve do backend (PageRank dos pagadores)
    // tol=0 → bloqueia hubs de rede com pagerank > p85 (stricto)
    // tol=30 → bloqueia apenas pagerank > p97 (permissivo)
    const contPoint = (data.contagio_curve ?? []).reduce<typeof data.contagio_curve[0] | null>(
      (prev, curr) =>
        prev === null || Math.abs(curr.tol - contagioTol) < Math.abs(prev.tol - contagioTol)
          ? curr : prev,
      null
    );
    const contagioBlocked      = contPoint?.n_blocked      ?? 0;
    const contagioBlockedValue = contPoint?.valor_blocked   ?? 0;
    const contagioBlockedEl    = contPoint?.el_blocked      ?? 0;
    const pageRankThresh       = contPoint?.pagerank_threshold ?? 0;

    // Heatmap proxy: células com default_rate > threshold são "zona de contágio"
    // tol=0 → thresh=0.30 (mais células marcadas); tol=30 → thresh=0.60 (menos células)
    const contagioRateThreshold = 0.30 + contagioTol / 100;

    // EL economizado simulado (score) via proporção de n_aprovado
    const zeroPoint   = data.impact_curve[0];
    const baseBlocked = zeroPoint.n_aprovado - (basePoint?.n_aprovado ?? zeroPoint.n_aprovado);
    const simBlocked  = zeroPoint.n_aprovado - (curvePoint?.n_aprovado ?? zeroPoint.n_aprovado);
    const simElScore  = baseBlocked > 0
      ? data.el_economizado * Math.max(0, simBlocked) / baseBlocked
      : 0;
    // EL total = EL evitado pelo score + EL evitado pelo contágio
    const simElEconomizado = simElScore + contagioBlockedEl;

    const simReceita       = curvePoint?.receita_pct       ?? data.taxa_aprovacao;
    const simInadimplencia = curvePoint?.inadimplencia_pct ?? 0;
    const baseReceita      = basePoint?.receita_pct        ?? data.taxa_aprovacao;

    return {
      effectiveScore,
      pdScore,
      pdIsBinding: pdScore > scoreMin,
      simReceita,
      simInadimplencia,
      simRejeicao: 100 - simReceita,
      deltaAprovacao: simReceita - baseReceita,
      contagioBlocked,
      contagioBlockedValue,
      contagioBlockedEl,
      pageRankThresh,
      contagioRateThreshold,
      simElEconomizado,
      simElScore,
      simBlocked,
      baseBlocked,
    };
  }, [data, pipeline, scoreMin, maxPD, contagioTol]);

  if (loading) return (
    <div className="text-white p-8 font-mono animate-pulse uppercase tracking-widest">
      CARREGANDO POLÍTICA DE REJEIÇÃO...
    </div>
  );
  if (!data) return (
    <div className="text-heat p-8 font-mono border border-heat/30 rounded-lg bg-heat/5">
      ERRO AO CARREGAR DADOS DE POLÍTICA.
    </div>
  );

  const approvalColor = sim && sim.simReceita < 90 ? 'text-heat' : sim && sim.simReceita < 95 ? 'text-lime' : 'text-mint';

  return (
    <>
      <TopNav title="POLÍTICA DE REJEIÇÃO" subtitle="UNDERWRITING — SIMULAÇÃO DE CORTES E TRAVAS DE SEGURANÇA" />

      {/* ── Policy Sliders + Economia de Perda (70/30) ─────────────────────── */}
      <div className="grid grid-cols-10 gap-4 mb-6">
      <BentoCell 
        className="col-span-7"
        title="Painel de Simulação de Política"
        tooltip="Ajuste os parâmetros de risco para simular o comportamento da carteira. A Régua de Score e o Limite de PD definem o filtro de entrada, enquanto a Tolerância de Contágio atua como uma trava de segurança sistêmica."
      >
        <div className="flex items-center gap-2 -mt-1 mb-5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-mint/60" />
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex-1">
            Configuração de Política —{' '}
            {isDefault
              ? <span className="text-mint/60">política padrão ativa</span>
              : <span className="text-lime">simulação ativa</span>
            }
          </span>
          {!isDefault && (
            <button
              onClick={() => { setScoreMin(DEFAULTS.scoreMin); setMaxPD(DEFAULTS.maxPD); setContagioTol(DEFAULTS.contagioTol); }}
              className="flex items-center gap-1.5 text-[9px] font-mono text-white/30 hover:text-white border border-white/10 hover:border-white/30 px-2.5 py-1 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> RESETAR
            </button>
          )}
        </div>

        <div className="flex gap-10">
          <PolicySlider
            label="Régua Mínima de Score"
            value={scoreMin}
            min={100}
            max={1000}
            step={50}
            display={String(scoreMin)}
            color="#73f3c7"
            hint={`score_mat ≥ ${scoreMin} → aprovação`}
            onChange={setScoreMin}
          />
          <PolicySlider
            label="Limite Máximo de PD (Inadimplência)"
            value={maxPD}
            min={5}
            max={90}
            step={5}
            display={`${maxPD}%`}
            color="#c3f400"
            hint={`PD ≤ ${maxPD}% → aprovação por PD${sim?.pdIsBinding ? ' · ativo' : ''}`}
            onChange={setMaxPD}
          />
          <PolicySlider
            label="Tolerância de Contágio"
            value={contagioTol}
            min={0}
            max={30}
            step={1}
            display={`${contagioTol}%`}
            color="#ff7162"
            hint={`máx ${contagioTol}% carteira com risco de rede`}
            onChange={setContagioTol}
          />
        </div>

        {/* Effective policy display */}
        {sim && (
          <div className="flex gap-3 mt-5 pt-4 border-t border-white/5">
            <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest self-center">Política efetiva:</div>
            <span className="text-[10px] font-mono text-mint border border-mint/20 bg-mint/5 px-2.5 py-1 rounded">
              score ≥ {sim.effectiveScore}
            </span>
            {sim.pdIsBinding && (
              <span className="text-[10px] font-mono text-lime border border-lime/20 bg-lime/5 px-2.5 py-1 rounded">
                PD ≤ {maxPD}% <span className="text-white/30">(eleva score → {sim.pdScore})</span>
              </span>
            )}
            <span className={`text-[10px] font-mono px-2.5 py-1 rounded border ${sim.contagioBlocked > 0 ? 'text-heat border-heat/20 bg-heat/5' : 'text-white/20 border-white/5'}`}>
              contágio: {sim.contagioBlocked > 0
                ? `bloqueando ${sim.contagioBlocked} ops (pagerank > ${sim.pageRankThresh.toFixed(4)})`
                : `tolerância ${contagioTol}% · ${sim.contagioBlocked} ops bloqueadas`}
            </span>
            {!isDefault && sim.deltaAprovacao !== 0 && (
              <span className={`ml-auto text-[10px] font-mono font-bold px-2.5 py-1 rounded ${sim.deltaAprovacao < 0 ? 'text-heat/80 border border-heat/20 bg-heat/5' : 'text-mint/80 border border-mint/20 bg-mint/5'}`}>
                Δ aprovação: {sim.deltaAprovacao > 0 ? '+' : ''}{fmtPct(sim.deltaAprovacao)}
              </span>
            )}
          </div>
        )}
      </BentoCell>

      {/* ── Economia de Perda (30%) ── */}
      <BentoCell 
        title="Economicidade e Perda Evitada" 
        tooltip="Montante financeiro de Perda Esperada (EL) que deixará de entrar na carteira caso a política simulada seja aplicada. Representa o valor 'salvo' pelo motor de risco."
        className="col-span-3 flex flex-col justify-between"
      >
        <div className="mt-2 flex-1 flex flex-col justify-center gap-4">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-mono font-bold text-mint tracking-tighter">
                {fmtCompact(sim?.simElEconomizado ?? data.el_economizado)}
              </span>
              {!isDefault && sim && sim.simElEconomizado !== data.el_economizado && (
                <span className="text-[10px] font-mono text-white/40">
                  base: <span className="text-white/60">{fmtCompact(data.el_economizado)}</span>
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest leading-relaxed">
              {isDefault
                ? 'EL evitado — política base'
                : `score < ${sim?.effectiveScore} · ${sim?.simBlocked ?? 0} ops`}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[11px] font-mono text-mint border border-mint/30 bg-mint/10 px-2.5 py-1 rounded justify-between">
              <span className="text-white/40 text-[9px]">SCORE</span>
              <span>≥ {sim?.effectiveScore ?? 400}</span>
            </div>
            <div className={`flex items-center gap-2 text-[11px] font-mono border px-2.5 py-1 rounded justify-between transition-colors ${sim?.pdIsBinding ? 'text-lime border-lime/30 bg-lime/10' : 'text-white/20 border-white/5'}`}>
              <span className="text-white/40 text-[9px]">PD</span>
              <span>≤ {maxPD}%{sim?.pdIsBinding ? ' ✓' : ''}</span>
            </div>
            <div className={`flex items-center gap-2 text-[11px] font-mono border px-2.5 py-1 rounded justify-between transition-colors ${(sim?.contagioBlocked ?? 0) > 0 ? 'text-heat border-heat/30 bg-heat/10' : 'text-white/20 border-white/5'}`}>
              <span className="text-white/40 text-[9px]">CONTÁGIO</span>
              <span>tol. {contagioTol}%{(sim?.contagioBlocked ?? 0) > 0 ? ' ✓' : ''}</span>
            </div>
          </div>
        </div>
      </BentoCell>
      </div>{/* fim grid 70/30 */}

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <BentoCell 
          title={isDefault ? 'Taxa de Aprovação' : 'Aprovação Simulada'} 
          tooltip="Percentual de operações que seriam aprovadas sob as condições da política atual. Uma queda nesta taxa geralmente indica um aumento na qualidade média dos ativos selecionados."
          status="mint" 
          icon={ShieldCheck}
        >
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-mono font-bold tracking-tighter ${approvalColor}`}>
                {fmtPct(sim?.simReceita ?? data.taxa_aprovacao)}
              </span>
              {!isDefault && sim && sim.deltaAprovacao !== 0 && (
                <span className={`text-xs font-mono font-bold ${sim.deltaAprovacao < 0 ? 'text-heat' : 'text-mint'}`}>
                  {sim.deltaAprovacao > 0 ? '▲' : '▼'}{fmtPct(Math.abs(sim.deltaAprovacao))}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
              {isDefault ? 'score > 400 (política atual)' : `score ≥ ${sim?.effectiveScore} (simulado)`}
            </div>
          </div>
        </BentoCell>

        <BentoCell 
          title={isDefault ? 'Índice de Seletividade de Ativos' : 'Seletividade Simulada'} 
          tooltip="Percentual de operações bloqueadas pelos filtros de Score, PD ou Contágio. Reflete o rigor da política em descartar ativos de alto risco."
          status="heat" 
          icon={ShieldAlert}
        >
          <div className="mt-2">
            <span className="text-xl font-mono font-bold tracking-tighter text-heat">
              {fmtPct(sim?.simRejeicao ?? data.taxa_rejeicao)}
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
              {isDefault ? 'Boletos bloqueados pela política' : `bloqueados por score < ${sim?.effectiveScore}`}
            </div>
          </div>
        </BentoCell>

        <BentoCell title="Inadimplência no Corte" status="lime" icon={TrendingDown}
          tooltip="Taxa histórica de inadimplência dos boletos aprovados pela política simulada. Queda indica política mais restritiva selecionando pagadores melhores.">
          <div className="mt-2">
            <span className="text-xl font-mono font-bold text-white tracking-tighter">
              {fmtPct(sim?.simInadimplencia ?? 0)}
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
              Inad. esperada na carteira aprovada
            </div>
          </div>
        </BentoCell>

        <BentoCell title="Bloqueio por Contágio" status={(sim?.contagioBlocked ?? 0) > 0 ? 'heat' : 'lime'} icon={AlertTriangle}
          tooltip="Ops bloqueadas por alto PageRank (hubs de rede sistêmica). tol=0% = zero tolerância (bloqueia pagerank > p85). tol=30% = permissivo (bloqueia apenas pagerank > p97).">
          <div className="mt-2">
            <span className="text-xl font-mono font-bold text-white tracking-tighter">
              {sim?.contagioBlocked ?? 0}
            </span>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
              {fmtCompact(sim?.contagioBlockedValue ?? 0)} · EL {fmtCompact(sim?.contagioBlockedEl ?? 0)}
            </div>
          </div>
        </BentoCell>

      </div>

      {/* ── Linha 1: Curva de Impacto + Heatmap ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <BentoCell
          title="Impacto do Corte — Receita vs Inadimplência por Parâmetros de Decisão"
          tooltip="Arraste o slider de Score para ver como a linha vertical se move e quais métricas mudam. O 'sweet spot' fica onde as curvas mais se afastam."
          className="h-[380px] flex flex-col"
        >
          <p className="text-[9px] font-mono text-white/30 -mt-3 mb-3">
            Eixo X: score mínimo · <span style={{ color: '#73f3c7' }}>— régua atual</span>
            {sim?.pdIsBinding && <span style={{ color: '#c3f400' }}> · — limite PD</span>}
          </p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.impact_curve} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="threshold"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 7, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  label={{ value: 'Score mínimo', position: 'insideBottomRight', offset: -8,
                           fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 7, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [
                    fmtPct(value),
                    name === 'receita_pct' ? 'Receita Aprovada' : 'Inadimplência',
                  ]}
                  labelFormatter={l => `Score ≥ ${l}`}
                />
                <Legend
                  formatter={v => (
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                      {v === 'receita_pct' ? 'Receita aprovada' : 'Inadimplência'}
                    </span>
                  )}
                />
                {/* Score Min reference line */}
                <ReferenceLine
                  x={scoreMin}
                  stroke="#73f3c7"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{ value: `≥${scoreMin}`, position: 'insideTopLeft', fill: '#73f3c7', fontSize: 8, fontFamily: 'monospace' }}
                />
                {/* PD binding line (only when PD is stricter than score) */}
                {sim?.pdIsBinding && (
                  <ReferenceLine
                    x={sim.pdScore}
                    stroke="#c3f400"
                    strokeWidth={1.5}
                    strokeDasharray="2 4"
                    label={{ value: `PD≤${maxPD}%`, position: 'insideTopRight', fill: '#c3f400', fontSize: 8, fontFamily: 'monospace' }}
                  />
                )}
                <Line type="monotone" dataKey="receita_pct"       stroke="#73f3c7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="inadimplencia_pct" stroke="#ff7162" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </BentoCell>

        <DecisionHeatmap
          data={data.heatmap_data}
          scoreBins={data.heatmap_score_bins}
          liqBins={data.heatmap_liq_bins}
          effectiveScore={sim?.effectiveScore ?? 400}
          contagioRateThreshold={sim?.contagioRateThreshold ?? 0.3}
        />

      </div>

      {/* ── Decision Table (New) ────────────────────────────────────────── */}
      {reportData.length > 0 && <DecisionTable data={reportData} policy={{ ...sim, maxPD }} />}
      
      <div className="mt-8 text-[10px] font-mono text-white/10 flex justify-between items-center px-2">
        <span>RELATÓRIO FINAL — MOTOR PIDC</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
    </>
  );
};
