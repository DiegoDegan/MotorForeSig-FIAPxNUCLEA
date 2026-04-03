
import React from 'react';

const SurvivalChart: React.FC = () => {
  // Static path data generation for the demo
  const width = 800;
  const height = 200;
  const padding = 20;

  // Generate MFS Curve (Better prediction, stabilizes)
  const generateMfsPath = () => {
    // Starting at 0,100% -> ending at 120,80% approx
    // Using cubic bezier for "suave" curve
    return `M ${padding} 20 C ${width * 0.3} 20, ${width * 0.5} 80, ${width - padding} 90`;
  };

  // Generate Traditional Curve (Linear drop, simplistic)
  const generateTradPath = () => {
    return `M ${padding} 20 L ${width - padding} 150`;
  };

  return (
    <div className="w-full h-full relative p-4 flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            Curva de Sobrevivência (120 Dias)
          </h3>
          <p className="text-xs text-mfs-text">Probabilidade de liquidação vs. Modelo Tradicional</p>
        </div>
        <div className="flex gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-mfs-lime"></span>
            <span className="text-mfs-lime">Modelo MFS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-mfs-mint border-b border-dashed"></span>
            <span className="text-mfs-mint opacity-50">Tradicional</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative overflow-hidden bg-mfs-bg/30 rounded border border-white/5">
        <svg
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#CCFF00" />
              <stop offset="100%" stopColor="#0F1218" stopOpacity="0" />
            </linearGradient>
            <filter id="glow-lime" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
          </defs>

          {/* Grid Lines */}
          <line x1="0" y1="50" x2={width} y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <line x1="0" y1="100" x2={width} y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <line x1="0" y1="150" x2={width} y2="150" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

          {/* Linha vertical de risco (sem texto) */}
          <line
            x1={width * 0.5}
            y1="20"
            x2={width * 0.5}
            y2={height}
            stroke="#FF3B30"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.6"
          />

          {/* Traditional Line (Dashed, Static) */}
          <path
            d={generateTradPath()}
            fill="none"
            stroke="#57D9AE"
            strokeWidth="2"
            strokeDasharray="8 4"
            opacity="0.5"
          />

          {/* MFS Line (Neon Lime, Animated) */}
          <path
            d={generateMfsPath()}
            fill="none"
            stroke="#CCFF00"
            strokeWidth="3"
            filter="url(#glow-lime)"
          >
            <animate
              attributeName="d"
              values={`M ${padding} 20 C ${width * 0.3} 20, ${width * 0.5} 80, ${width - padding} 90;
                       M ${padding} 20 C ${width * 0.3} 25, ${width * 0.5} 85, ${width - padding} 95;
                       M ${padding} 20 C ${width * 0.3} 20, ${width * 0.5} 80, ${width - padding} 90`}
              dur="4s"
              repeatCount="indefinite"
            />
          </path>

          {/* Area under curve (gradient) */}
          <path
            d={`${generateMfsPath()} L ${width - padding} ${height} L ${padding} ${height} Z`}
            fill="url(#area-gradient)"
            opacity="0.1"
          />
        </svg>

        {/* Callout de risco fora do SVG (HTML Overlay para evitar distorção) */}
        <div
          className="absolute bg-mfs-bg/95 border border-mfs-red/40 text-mfs-red text-xs p-2.5 rounded backdrop-blur-sm shadow-[0_4px_10px_rgba(255,59,48,0.15)] inline-block font-mono leading-relaxed"
          style={{
            left: '52%',
            top: '30%',
          }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
             <span>⚠️</span>
             <span className="font-bold tracking-tight">Aceleração de Risco</span>
          </div>
          <span className="text-[10px] opacity-80 font-semibold block text-center tracking-wide">
            (Risco de Cauda)
          </span>
        </div>

        {/* Axis Labels */}
        <div className="absolute bottom-2 left-4 text-[10px] text-mfs-text font-mono">Dia 0</div>
        <div className="absolute bottom-2 right-4 text-[10px] text-mfs-text font-mono">Dia 120</div>
      </div>
    </div>
  );
};

export default SurvivalChart;
