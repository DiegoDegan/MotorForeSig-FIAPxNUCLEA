import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { TopNav, BentoCell } from '../../components/shared';
import { getCreditPipeline } from '../../services/api';

const ShapDrawer = ({ operation, onClose }: { operation: any, onClose: () => void }) => {
  if (!operation) return null;

  const factors = operation.justificativa_mesa || [];

  return (
    <div className="w-[400px] bg-surface border border-white/5 rounded-lg flex flex-col h-[calc(100vh-6rem)] sticky top-8 shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-300">
      <div className="p-6 border-b border-white/5 flex justify-between items-start bg-surface-high/50">
        <div>
          <h2 className="text-lg font-display font-bold text-mint tracking-wider">RELATÓRIO DE EXPLICABILIDADE SHAP</h2>
          <div className="text-[10px] font-mono text-white/50 mt-1">ID BOLETO: {operation.id_boleto}</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-obsidian border border-white/5 rounded-lg p-4">
            <div className="text-[10px] font-mono text-white/50 mb-2">VALOR NOMINAL</div>
            <div className="text-xl font-mono font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.valor_nominal)}
            </div>
          </div>
          <div className="bg-obsidian border border-white/5 rounded-lg p-4">
            <div className="text-[10px] font-mono text-white/50 mb-2">PERDA ESPERADA (EL)</div>
            <div className="text-xl font-mono font-bold text-heat text-glow-heat">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.valor_esperado_perda)}
            </div>
          </div>
        </div>

        <div className="mb-2 flex justify-between items-end">
          <h3 className="text-[10px] font-mono text-white/50 uppercase tracking-widest">JUSTIFICATIVA MESA (SHAP LÓGICO)</h3>
        </div>
        
        <div className="bg-obsidian border border-white/5 rounded-lg p-5">
          {factors.map((factor: any, idx: number) => {
            const isPositive = factor.value > 0;
            const width = Math.min(Math.abs(factor.value) * 150, 100); 
            
            return (
              <div key={idx} className="mb-5 last:mb-0">
                <div className="flex justify-between text-[10px] font-mono mb-2">
                  <span className="text-white/70">{factor.name}</span>
                  <span className={isPositive ? 'text-heat' : 'text-mint'}>
                    {isPositive ? '+' : ''} {typeof factor.value === 'number' ? factor.value.toFixed(2) : factor.value}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full flex relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                  <div className="flex w-full">
                    <div className="flex-1 flex justify-end">
                      {!isPositive && <div className="h-full bg-mint rounded-l-full" style={{ width: `${width}%` }} />}
                    </div>
                    <div className="flex-1">
                      {isPositive && <div className="h-full bg-heat rounded-r-full" style={{ width: `${width}%` }} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-[10px] font-mono text-white/50">PROB. DEFINITIVA (PD)</span>
            <span className={`text-xl font-mono font-bold ${operation.score_pd >= 0.7 ? 'text-heat text-glow-heat' : 'text-lime'}`}>
              {(operation.score_pd).toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-surface-high/30 flex flex-col gap-3">
        <button className="w-full py-3 bg-transparent border border-white/10 text-white/70 font-mono text-[10px] rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> EXPORTAR RELATÓRIO PDF
        </button>
        <div className="flex gap-3">
          <button className="flex-1 py-3 bg-heat/20 border border-heat/30 text-heat font-display font-bold tracking-widest rounded-lg hover:bg-heat hover:text-obsidian transition-colors">
            REJEITAR / BLOQUEAR
          </button>
          <button className="flex-1 py-3 bg-mint/20 border border-mint/30 text-mint font-display font-bold tracking-widest rounded-lg hover:bg-mint hover:text-obsidian transition-colors">
            APROVAR OVERRIDE
          </button>
        </div>
      </div>
    </div>
  );
};

export const MesaCreditoScreen = () => {
  const [selectedOp, setSelectedOp] = useState<any | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await getCreditPipeline();
      if (result) setData(result);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-white p-8 font-mono">LOADING PIPELINE DATA...</div>;

  return (
    <div className="flex gap-6 h-full items-start">
      <div className={`flex-1 transition-all duration-300 ${selectedOp ? 'w-[calc(100%-424px)]' : 'w-full'}`}>
        <TopNav title="MESA DE CRÉDITO" subtitle="GESTÃO OPERACIONAL BOLETOS" />
        
        <div className="flex gap-4 mb-6">
          <div className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint font-mono text-[10px] rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-mint rounded-sm" /> TODAS AS OPERAÇÕES [{data.length}]
          </div>
        </div>

        <BentoCell status="none" className="h-[calc(100vh-16rem)] overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <table className="w-full text-left font-mono text-[11px] border-collapse">
              <thead className="sticky top-0 bg-surface z-10 shadow-md">
                <tr className="text-white/40 border-b border-white/10">
                  <th className="py-4 font-normal px-2">ID BOLETO</th>
                  <th className="py-4 font-normal px-2">SACADO (FANTASIA)</th>
                  <th className="py-4 font-normal px-2 text-right">VALOR NOMINAL</th>
                  <th className="py-4 font-normal px-4 text-center">PD (SCORE)</th>
                  <th className="py-4 font-normal px-2 text-right">EL (PERDA)</th>
                  <th className="py-4 font-normal px-2 pl-6">AÇÃO SUGERIDA</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const isBlocked = row.acao_sugerida === 'BLOQUEAR';
                  const isSelected = selectedOp?.id_boleto === row.id_boleto;
                  const trClassObj = isBlocked 
                    ? "bg-[#ffcccc] text-[#8b0000] border-b border-red-300 hover:bg-[#ffb3b3]" 
                    : `border-b border-white/5 hover:bg-white/5 text-white/80`;

                  const selectedClass = isSelected && !isBlocked ? 'bg-white/10' : '';
                  const selectedBlockedClass = isSelected && isBlocked ? 'ring-2 ring-red-500 inset-0' : '';

                  return (
                    <tr 
                      key={i} 
                      onClick={() => setSelectedOp(row)}
                      className={`transition-colors cursor-pointer relative ${trClassObj} ${selectedClass} ${selectedBlockedClass}`}
                    >
                      <td className="py-3 px-2 font-bold">{row.id_boleto}</td>
                      <td className="py-3 px-2">{row.sacado_nome_fantasia}</td>
                      <td className="py-3 px-2 text-right font-mono">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_nominal)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-center">
                          <span className={`${isBlocked ? 'text-[#8b0000]' : 'text-white'}`}>{(row.score_pd).toFixed(2)}</span>
                          <div className="w-12 h-1.5 bg-black/20 rounded-full overflow-hidden">
                            <div className="h-full bg-current rounded-full" style={{ width: `${row.score_pd * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_esperado_perda)}
                      </td>
                      <td className="py-3 px-2 pl-6">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                          isBlocked ? 'bg-[#8b0000] text-white' : 
                          row.acao_sugerida === 'APROVAR_AUTO' ? 'bg-mint/20 text-mint border border-mint/30' : 
                          'bg-lime/20 text-lime border border-lime/30'
                        }`}>
                          {row.acao_sugerida}
                        </span>
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
        <ShapDrawer operation={selectedOp} onClose={() => setSelectedOp(null)} />
      )}
    </div>
  );
};
