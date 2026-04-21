import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TopNav, BentoCell } from '../../components/shared';
import { getGovernanceMetrics } from '../../services/api';

const PsiGauge = ({ value }: { value: number }) => {
  const max = 0.25;
  const percentage = Math.min(value / max, 1);
  const radius = 80;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage * circumference);

  return (
    <BentoCell title="Status Global PSI" className="col-span-1 flex flex-col items-center justify-center h-[280px]">
      <div className="relative w-48 h-24 mt-4">
        <svg className="w-full h-full overflow-visible">
          <path
            d={`M 16 96 A 80 80 0 0 1 176 96`}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d={`M 16 96 A 80 80 0 0 1 176 96`}
            fill="none"
            stroke="var(--color-mint)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: 'drop-shadow(0 0 8px rgba(115,243,199,0.5))' }}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 text-center flex flex-col items-center">
          <span className="text-3xl font-mono font-bold text-mint text-glow-mint">{value.toFixed(3)}</span>
          <span className="text-[10px] font-mono text-mint/70 mt-1 bg-mint/10 px-2 py-0.5 rounded">ESTÁVEL</span>
        </div>
      </div>
      <div className="flex justify-between w-full px-8 mt-6 text-[10px] font-mono text-white/40">
        <span>0.00</span>
        <span>0.10 (Alerta)</span>
        <span>0.25+</span>
      </div>
    </BentoCell>
  );
};

const PerformanceCards = ({ ks, auc }: { ks: number, auc: number }) => (
  <div className="col-span-1 flex flex-col gap-4 h-[280px]">
    <BentoCell title="Estatística KS" className="flex-1 flex flex-col justify-center">
      <div className="flex items-end justify-between">
        <div className="text-4xl font-mono font-bold text-white">{ks.toFixed(2)}</div>
        <div className="text-[10px] font-mono text-lime mb-1">EXCELENTE</div>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-lime rounded-full w-[84%]" />
      </div>
    </BentoCell>
    <BentoCell title="AUC-ROC" className="flex-1 flex flex-col justify-center">
      <div className="flex items-end justify-between">
        <div className="text-4xl font-mono font-bold text-white">{auc.toFixed(2)}</div>
        <div className="text-[10px] font-mono text-mint mb-1">ESTÁVEL</div>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-mint rounded-full w-[88%]" />
      </div>
    </BentoCell>
  </div>
);

const PolicyControl = ({ initialThresholds }: { initialThresholds: any }) => {
  const [autoApprovePd, setAutoApprovePd] = useState(initialThresholds?.auto || 0.025);
  const [manualReviewPd, setManualReviewPd] = useState(initialThresholds?.manual || 0.050);
  const [maxExposure, setMaxExposure] = useState(initialThresholds?.exposure || 5000000);

  return (
    <BentoCell title="Controle de Thresholds (Simulador YAML)" className="col-span-2 h-[280px] overflow-hidden flex flex-col">
      <div className="absolute top-5 right-5 flex gap-2">
        <div className="px-2 py-1 bg-heat/10 text-heat text-[10px] font-mono rounded border border-heat/20 animate-pulse">MODO RASCUNHO</div>
      </div>
      
      <div className="flex gap-6 mt-4 flex-1 h-full">
        <div className="flex-1 flex flex-col gap-4 font-mono text-[10px]">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white/60">AUTO_APPROVE_PD_MAX</span>
              <span className="text-mint">{autoApprovePd.toFixed(3)}</span>
            </div>
            <input type="range" min="0.01" max="0.10" step="0.005" value={autoApprovePd} onChange={(e) => setAutoApprovePd(parseFloat(e.target.value))} className="w-full accent-mint h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white/60">MANUAL_REVIEW_PD_MAX</span>
              <span className="text-lime">{manualReviewPd.toFixed(3)}</span>
            </div>
            <input type="range" min="0.05" max="0.20" step="0.005" value={manualReviewPd} onChange={(e) => setManualReviewPd(parseFloat(e.target.value))} className="w-full accent-lime h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white/60">MAX_EXPOSURE_BRL</span>
              <span className="text-white">{(maxExposure / 1000000).toFixed(1)}M</span>
            </div>
            <input type="range" min="1000000" max="10000000" step="500000" value={maxExposure} onChange={(e) => setMaxExposure(Number(e.target.value))} className="w-full accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
          </div>
          
          <button className="mt-auto bg-mint/20 border border-mint/40 text-mint py-2 hover:bg-mint hover:text-obsidian transition-colors font-bold tracking-widest text-[10px]">
            PUBLICAR POLÍTICA
          </button>
        </div>

        <div className="flex-1 bg-obsidian-light rounded border border-white/5 p-3 overflow-y-auto text-[10px] leading-relaxed">
          <pre className="text-white/50">
<span className="text-heat">policy_id</span>: <span className="text-lime">"POL_SIM_DRAFT"</span>
<span className="text-heat">status</span>: <span className="text-lime">"TESTING"</span>
<span className="text-heat">thresholds</span>:
  <span className="text-mint">auto_approve_pd</span>: <span className="text-white">{autoApprovePd.toFixed(3)}</span>
  <span className="text-mint">manual_review_pd</span>: <span className="text-white">{manualReviewPd.toFixed(3)}</span>
  <span className="text-mint">max_exposure_brl</span>: <span className="text-white">{maxExposure}</span>
<span className="text-heat">banned_cnaes</span>:
  - <span className="text-lime">"9200-3/99"</span>
  - <span className="text-lime">"6499-9/99"</span>
  - <span className="text-lime">"6419-7/00"</span>
          </pre>
        </div>
      </div>
    </BentoCell>
  );
};

const KaplanMeierChart = ({ kmData }: { kmData: any[] }) => {
  const CustomTooltipKM = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-obsidian/90 border border-white/20 p-2 font-mono text-[10px]">
          <div className="text-white/50 mb-1">ATRASO: <span className="text-white">{label} DIAS</span></div>
          <div className="text-mint">PROBABILIDADE RECEBIMENTO: <span className="font-bold text-white">{(payload[0].value * 100).toFixed(1)}%</span></div>
        </div>
      );
    }
    return null;
  };

  return (
    <BentoCell title="Curva de Sobrevivência (Kaplan-Meier)" className="col-span-2 h-[320px]">
      <div className="mt-6 h-full w-full pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kmData} margin={{ top: 10, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="days" 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} 
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis 
              domain={[0, 1]} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} 
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltipKM />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
            <Line 
              type="stepAfter" 
              dataKey="probability" 
              stroke="var(--color-mint)" 
              strokeWidth={2} 
              dot={{ r: 3, fill: 'var(--color-obsidian)', stroke: 'var(--color-mint)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--color-mint)', stroke: 'var(--color-obsidian)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </BentoCell>
  );
};

const AuditLogs = ({ logs }: { logs: any[] }) => {
  return (
    <BentoCell title="Logs de Auditoria (Governança MFS)" className="col-span-2 h-[320px]">
      <div className="absolute top-5 right-5 flex gap-2">
        <div className="px-2 py-1 bg-surface-high text-white/50 text-[10px] font-mono rounded border border-white/10">ÚLTIMOS EVENTOS</div>
      </div>
      <div className="mt-6 flex flex-col gap-3 overflow-y-auto h-[calc(100%-2rem)] pr-2">
        {logs.map((log, idx) => (
          <div key={idx} className="bg-obsidian/50 border border-white/5 p-3 rounded text-[10px] font-mono flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <span className="text-white/40">{log.date}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] tracking-widest ${log.action.includes('BLOCK') ? (log.action === 'UNBLOCK_CNAE' ? 'bg-lime/20 text-lime border border-lime/20' : 'bg-heat/20 text-heat border border-heat/20') : 'bg-mint/20 text-mint border border-mint/20'}`}>
                {log.action}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-3 h-3 text-white/40" />
              <span className="text-white/80">{log.user}</span>
            </div>
            <div className="text-white mt-1 font-bold">{log.details}</div>
            <div className="text-white/50 text-[9px] mt-0.5 relative pl-2 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-white/10">
              {log.reason}
            </div>
          </div>
        ))}
      </div>
    </BentoCell>
  );
};

export const GovernancaScreen = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await getGovernanceMetrics();
      if (result) setData(result);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-white p-8 font-mono">LOADING GOVERNANCE DATA...</div>;
  if (!data) return <div className="text-heat p-8 font-mono">ERROR LOADING GOVERNANCE DATA.</div>;

  return (
    <div className="flex flex-col h-full">
      <TopNav title="GOVERNANÇA" subtitle="POLÍTICAS AUDITORIA MODELO" />
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <PsiGauge value={data.psi} />
        <PerformanceCards ks={data.ks} auc={data.auc} />
        <PolicyControl initialThresholds={data.thresholds} />
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <KaplanMeierChart kmData={data.km_data} />
        <AuditLogs logs={data.audit_logs} />
      </div>
    </div>
  );
};
