import React, { useState, useEffect } from 'react';
import { X, Download, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { TopNav, BentoCell, SegmentedBar } from '../../components/shared';
import { getCreditPipeline, recordOperationAction, PipelineOperation } from '../../services/api';

const ShapDrawer = ({ operation, onClose, onAction }: { operation: PipelineOperation, onClose: () => void, onAction: (action: string, reason: string) => void }) => {
  const [showReasonBox, setShowReasonBox] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState("");

  if (!operation) return null;

  const factors = operation.justificativa_mesa || [];
  const totalWithBoleto = operation.cedente_exposicao + operation.valor_nominal;
  const LIMIT = 5000000; // Fond limit from Governance
  const limitPercentage = (totalWithBoleto / LIMIT) * 100;

  const reasons = [
    "GARANTIA REAL ADICIONAL",
    "AJUSTE COMERCIAL ESTRATÉGICO",
    "ANÁLISE DE BALANÇO RECENTE",
    "ERRO DE CADASTRO NO SACADO",
    "PAGAMENTO JÁ IDENTIFICADO"
  ];

  const handleConfirm = () => {
    if (showReasonBox && selectedReason) {
      onAction(showReasonBox, selectedReason);
      setShowReasonBox(null);
      setSelectedReason("");
    }
  };

  return (
    <div className="w-[420px] bg-surface border border-white/5 rounded-lg flex flex-col h-[calc(100vh-6rem)] sticky top-8 shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-300 z-50">
      <div className="p-6 border-b border-white/5 flex justify-between items-start bg-surface-high/50">
        <div>
          <h2 className="text-lg font-display font-bold text-mint tracking-wider">INTELIGÊNCIA DE CRÉDITO</h2>
          <div className="text-[10px] font-mono text-white/50 mt-1">CONTEXTO CEDENTE: {operation.cedente}</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        {/* Termômetro de Exposição */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest">TERMÔMETRO DE EXPOSIÇÃO DO CEDENTE</h3>
            <span className={`text-[10px] font-mono font-bold ${limitPercentage > 80 ? 'text-heat' : 'text-mint'}`}>
              {limitPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="bg-obsidian border border-white/5 rounded-lg p-5">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-white/40">EXPOSIÇÃO ATUAL</span>
                <span className="text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.cedente_exposicao)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-mint">+ NOVO BOLETO</span>
                <span className="text-mint">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.valor_nominal)}
                </span>
              </div>
            </div>
            
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 bg-mint/40" style={{ width: `${(operation.cedente_exposicao / LIMIT) * 100}%` }} />
               <div className="absolute top-0 bottom-0 bg-mint animate-pulse" 
                    style={{ 
                      left: `${(operation.cedente_exposicao / LIMIT) * 100}%`, 
                      width: `${(operation.valor_nominal / LIMIT) * 100}%` 
                    }} 
               />
            </div>
            <div className="flex justify-between mt-2 text-[9px] font-mono text-white/30">
              <span>R$ 0</span>
              <span>LIMITE R$ 5.0M</span>
            </div>
          </div>
        </div>

        <div className="mb-2 flex justify-between items-end">
          <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest">PERFIL DE RISCO (SHAP CATEGORIZADO)</h3>
        </div>
        
        <div className="bg-obsidian border border-white/5 rounded-lg p-5 mb-8">
          {factors.map((factor: any, idx: number) => {
            const isPositive = factor.value > 0;
            const width = Math.min(Math.abs(factor.value) * 150, 100); 
            
            return (
              <div key={idx} className="mb-5 last:mb-0">
                <div className="flex justify-between text-[10px] font-mono mb-2">
                  <span className="text-white/70 uppercase">{factor.name}</span>
                  <span className={isPositive ? 'text-heat' : 'text-mint'}>
                    {isPositive ? 'CONTRA' : 'A FAVOR'}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full flex relative">
                  <div className="flex w-full">
                    <div className="flex-1 flex justify-end">
                      {!isPositive && <div className="h-full bg-mint rounded-l-full shadow-[0_0_8px_rgba(115,243,199,0.5)]" style={{ width: `${width}%` }} />}
                    </div>
                    <div className="flex-1">
                      {isPositive && <div className="h-full bg-heat rounded-r-full shadow-[0_0_8px_rgba(255,113,98,0.5)]" style={{ width: `${width}%` }} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {operation.risco_contagio && (
          <div className="bg-heat/10 border border-heat/30 p-4 rounded-lg flex gap-3 mb-8">
            <AlertTriangle className="w-5 h-5 text-heat shrink-0" />
            <div>
              <div className="text-[10px] font-mono font-bold text-heat uppercase">Alerta de Risco Sistêmico</div>
              <p className="text-[10px] text-white/60 leading-relaxed mt-1 font-mono">
                Este sacado possui alta conectividade em redes de contágio detectadas. A inadimplência pode propagar para outros 5+ cedentes.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/5 bg-surface-high/30 flex flex-col gap-3 relative">
        {showReasonBox && (
          <div className="absolute inset-x-0 bottom-full bg-surface-high border-t border-white/10 p-6 animate-in slide-in-from-bottom-4 duration-200">
             <div className="text-[10px] font-mono text-white/50 mb-3 uppercase tracking-widest text-center">Justificativa de Decisão</div>
             <select 
               value={selectedReason} 
               onChange={(e) => setSelectedReason(e.target.value)}
               className="w-full bg-obsidian border border-white/10 text-white font-mono text-[10px] p-3 rounded-lg mb-4 outline-none focus:border-mint/50"
             >
               <option value="">SELECIONE UM MOTIVO...</option>
               {reasons.map(r => <option key={r} value={r}>{r}</option>)}
             </select>
             <div className="flex gap-2">
               <button onClick={() => setShowReasonBox(null)} className="flex-1 py-2 text-[10px] font-mono text-white/40 hover:text-white">CANCELAR</button>
               <button 
                 onClick={handleConfirm}
                 disabled={!selectedReason}
                 className="flex-1 py-2 bg-mint text-obsidian font-mono font-bold text-[10px] rounded disabled:opacity-30"
               >
                 CONFIRMAR AÇÃO
               </button>
             </div>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={() => setShowReasonBox("REPROVAR")}
            className="flex-1 py-3 bg-heat/20 border border-heat/30 text-heat font-display font-bold tracking-widest rounded-lg hover:bg-heat hover:text-obsidian transition-colors text-[11px]"
          >
            REPROVAR
          </button>
          <button 
            onClick={() => setShowReasonBox("APROVAR")}
            className="flex-1 py-3 bg-mint/20 border border-mint/30 text-mint font-display font-bold tracking-widest rounded-lg hover:bg-mint hover:text-obsidian transition-colors text-[11px]"
          >
            {operation.acao_sugerida === 'BLOQUEAR' ? 'APROVAR OVERRIDE' : 'APROVAR AUTO'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const MesaCreditoScreen = () => {
  const [selectedOp, setSelectedOp] = useState<PipelineOperation | null>(null);
  const [data, setData] = useState<PipelineOperation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const result = await getCreditPipeline();
    if (result) setData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: string, reason: string) => {
    if (!selectedOp) return;
    
    const success = await recordOperationAction(selectedOp.id_boleto, action, reason);
    if (success) {
      // Remove from view to simulate processing
      setData(prev => prev.filter(op => op.id_boleto !== selectedOp.id_boleto));
      setSelectedOp(null);
    }
  };

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-10 bg-white/5 rounded w-1/4" />
        <div className="h-64 bg-white/5 rounded w-full" />
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 h-full items-start">
      <div className={`flex-1 transition-all duration-300 ${selectedOp ? 'w-[calc(100%-444px)]' : 'w-full'}`}>
        <TopNav title="MESA DE CRÉDITO" subtitle="OPERACIONAL / PIPELINE" />
        
        <div className="flex gap-4 mb-6">
          <div className="px-4 py-2 bg-obsidian-light border border-white/10 text-white/50 font-mono text-[10px] rounded-lg flex items-center gap-2">
            <span className="text-mint font-bold">{data.length}</span> OPERAÇÕES PENDENTES
          </div>
          <div className="flex-1" />
          <div className="flex gap-4 items-center">
             <div className="text-[10px] font-mono text-white/30 flex items-center gap-2">
               <ShieldCheck className="w-3 h-3 text-mint" /> IA AUTO-GOVERNADA ATIVA
             </div>
          </div>
        </div>

        <BentoCell status="none" className="min-h-[calc(100vh-16rem)] overflow-hidden flex flex-col p-0 border border-white/5">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left font-mono text-[11px] border-collapse relative">
              <thead className="sticky top-0 bg-surface-high z-10">
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-tighter">
                  <th className="py-4 font-normal px-4 w-12"></th>
                  <th className="py-4 font-normal px-2">ID BOLETO</th>
                  <th className="py-4 font-normal px-2">SACADO / PAGADOR</th>
                  <th className="py-4 font-normal px-2 text-right">VALOR NOMINAL</th>
                  <th className="py-4 font-normal px-4 text-center">PD</th>
                  <th className="py-4 font-normal px-2 text-right">EL (PERDA)</th>
                  <th className="py-4 font-normal px-2 pl-6">CONTEXTO / AÇÃO IA</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const isBlocked = row.acao_sugerida === 'BLOQUEAR';
                  const isSelected = selectedOp?.id_boleto === row.id_boleto;
                  
                  return (
                    <tr 
                      key={i} 
                      onClick={() => setSelectedOp(row)}
                      className={`transition-all cursor-pointer group border-b border-white/5 
                                 ${isSelected ? 'bg-mint/5 ring-1 ring-mint/20' : 'hover:bg-white/[0.02]'} 
                                 ${isBlocked ? 'border-l-4 border-l-heat' : 'border-l-4 border-l-transparent'}`}
                    >
                      <td className="py-4 px-4 text-center">
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-mint translate-x-1' : 'text-white/10 group-hover:text-white/30'}`} />
                      </td>
                      <td className="py-4 px-2 font-bold text-white/90">{row.id_boleto}</td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col">
                           <span className="text-white/80">{row.sacado_nome_fantasia}</span>
                           <span className="text-[9px] text-white/30">{row.cedente}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-right font-mono text-white/90">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_nominal)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold ${row.score_pd > 0.4 ? 'text-heat' : 'text-lime'}`}>{(row.score_pd).toFixed(2)}</span>
                          <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.score_pd > 0.4 ? 'bg-heat' : 'bg-lime'}`} style={{ width: `${row.score_pd * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-right font-mono font-bold text-heat/80">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_esperado_perda)}
                      </td>
                      <td className="py-4 px-2 pl-6">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold tracking-widest ${
                            isBlocked ? 'bg-heat/20 text-heat border border-heat/30' : 
                            'bg-mint/20 text-mint border border-mint/30'
                          }`}>
                            {row.acao_sugerida}
                          </span>
                          {row.risco_contagio && (
                            <AlertTriangle className="w-4 h-4 text-heat animate-pulse" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </BentoCell>
      </div>

      {selectedOp && (
        <ShapDrawer 
          operation={selectedOp} 
          onClose={() => setSelectedOp(null)} 
          onAction={handleAction}
        />
      )}
    </div>
  );
};
