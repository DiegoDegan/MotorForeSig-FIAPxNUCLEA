import React from 'react';
import { Network, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { InsightCard } from '../types';

const insights: InsightCard[] = [
  { id: '1', title: 'Topologia de Rede', impact: 'High', value: 85, type: 'topology' },
  { id: '2', title: 'Risco Setorial', impact: 'Medium', value: 45, type: 'sector' },
  { id: '3', title: 'Histórico de Pagamento', impact: 'Low', value: 15, type: 'history' },
];

const ExplainabilityPanel: React.FC = () => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'topology': return <Network className="w-4 h-4 text-mfs-mint" />;
      case 'sector': return <AlertTriangle className="w-4 h-4 text-mfs-lime" />;
      case 'history': return <Clock className="w-4 h-4 text-blue-400" />;
      default: return <Network className="w-4 h-4" />;
    }
  };

  const impactLabels = {
    High: 'Alto',
    Medium: 'Médio',
    Low: 'Baixo'
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto custom-scrollbar">
      <div className="mb-6">
        <h3 className="text-white font-semibold text-lg">MFS Neural Engine</h3>
        <p className="text-xs text-mfs-text">Fatores determinantes do score</p>
      </div>

      <div className="space-y-4">
        {insights.map((card) => (
          <div 
            key={card.id}
            className="group bg-mfs-glass border border-white/5 hover:border-mfs-mint/30 backdrop-blur-md rounded-lg p-4 transition-all duration-300 hover:translate-x-1"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-white/5 border border-white/10">
                  {getIcon(card.type)}
                </div>
                <span className="text-sm text-gray-200 font-medium">{card.title}</span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                card.impact === 'High' ? 'border-mfs-mint text-mfs-mint bg-mfs-mint/10' :
                card.impact === 'Medium' ? 'border-mfs-lime text-mfs-lime bg-mfs-lime/10' :
                'border-gray-500 text-gray-400'
              }`}>
                {impactLabels[card.impact]}
              </span>
            </div>

            {/* Simulated SHAP Value Bar */}
            <div className="relative h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
              <div 
                className={`absolute top-0 left-0 h-full rounded-full ${
                    card.impact === 'High' ? 'bg-mfs-mint' : 
                    card.impact === 'Medium' ? 'bg-mfs-lime' : 'bg-blue-400'
                }`}
                style={{ 
                    width: `${card.value}%`,
                    animation: 'pulse 3s infinite ease-in-out' // Subtle breathing
                }}
              ></div>
              {/* Scanline effect on bar */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-gray-500">Contribuição</span>
              <span className={`${
                 card.impact === 'High' ? 'text-mfs-mint' : 
                 card.impact === 'Medium' ? 'text-mfs-lime' : 'text-blue-400'
              }`}>
                {card.impact === 'Low' ? '-' : '+'}{(card.value * 0.12).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}

        {/* PRESCRIPTIVE UX: SYSTEM RECOMMENDATION */}
        <div className="mt-8 pt-4 border-t border-dashed border-white/10">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] uppercase tracking-widest text-mfs-text font-bold">Recomendação do Sistema</h4>
                <div className="w-2 h-2 bg-mfs-lime rounded-full animate-ping"></div>
            </div>
            
            <div className="bg-mfs-lime/5 border border-mfs-lime/50 rounded-xl p-4 flex flex-col items-center gap-3 relative overflow-hidden group hover:bg-mfs-lime/10 transition-colors">
                {/* Background pulse effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-mfs-lime/10 to-transparent opacity-50"></div>
                
                <ShieldAlert className="w-8 h-8 text-mfs-lime mb-1 relative z-10" />
                
                <div className="text-center relative z-10">
                    <div className="text-white font-bold text-sm tracking-wide">ALTO RISCO DE CONTAMINAÇÃO</div>
                    <div className="text-[10px] text-mfs-text mt-1">Confiança do algoritmo: 98.2%</div>
                </div>

                <button className="w-full py-3 mt-1 bg-mfs-lime text-black font-bold text-xs tracking-wider rounded shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.6)] hover:scale-[1.02] transition-all relative z-10 flex items-center justify-center gap-2 animate-pulse-fast border-2 border-transparent hover:border-white">
                    ⛔ AÇÃO SUGERIDA: CONGELAR CRÉDITO
                </button>
            </div>
        </div>
      </div>

       {/* System Status at Bottom */}
       <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
             <span>Modelo v2.4.1</span>
             <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Online
             </span>
          </div>
       </div>
    </div>
  );
};

export default ExplainabilityPanel;