import React, { useEffect, useState, useRef } from 'react';
import { Node } from '../types';
import { Clock, GripHorizontal } from 'lucide-react';

const NetworkGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<Node[]>([]);
  
  // Drag & Drop State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hubLabelPos, setHubLabelPos] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        
        // Center label on init/resize if not manually moved yet? 
        // For simplicity, we stick to initial center, user moves from there.
        if (!isInitialized) {
          setHubLabelPos({ x: clientWidth / 2 - 60, y: clientHeight / 2 - 110 });
        }
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) return; // Only generate nodes once to preserve drag positions
    if (dimensions.width === 0) return;

    // Generate star topology
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
    
    const hubNode: Node = {
      id: 'hub',
      x: centerX,
      y: centerY,
      size: 60,
      type: 'HUB',
      label: 'Cedente Alpha',
      riskScore: 94
    };

    const satelliteCount = 8;
    const newNodes: Node[] = [hubNode];

    for (let i = 0; i < satelliteCount; i++) {
      const angle = (i * 2 * Math.PI) / satelliteCount;
      const isRisky = i === 3; // "Sacado 4" is the specific risky one
      
      const nodeSize = isRisky ? 48 : Math.floor(Math.random() * 15 + 20); 

      let exposureValue = "";
      if (isRisky) {
        exposureValue = "R$ 2.4M";
      } else {
        const val = (nodeSize * 0.045).toFixed(1);
        exposureValue = `R$ ${val}M`;
      }

      newNodes.push({
        id: `sat-${i}`,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        size: nodeSize,
        type: 'SATELLITE',
        label: `Sacado ${i + 1}`,
        riskScore: isRisky ? 45 : Math.floor(Math.random() * 20 + 80),
        exposure: exposureValue
      });
    }
    setNodes(newNodes);
    setIsInitialized(true);
  }, [dimensions, isInitialized]);

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent, id: string, currentX: number, currentY: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setDraggedId(id);
      setDragOffset({
        x: mouseX - currentX,
        y: mouseY - currentY
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedId || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - dragOffset.x;
    const newY = mouseY - dragOffset.y;

    if (draggedId === 'hub-label') {
      setHubLabelPos({ x: newX, y: newY });
    } else {
      setNodes(prev => prev.map(n => 
        n.id === draggedId ? { ...n, x: newX, y: newY } : n
      ));
    }
  };

  const handleMouseUp = () => {
    setDraggedId(null);
  };

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full relative overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(87,217,174,0.03)_0%,_rgba(15,18,24,0)_70%)] ${draggedId ? 'cursor-grabbing' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background Effect */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{
             backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }}>
      </div>

      {/* TIME TRAVEL SLIDER */}
      <div className="absolute top-6 left-6 z-30 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 text-mfs-text text-[10px] font-mono uppercase tracking-widest mb-1">
          <Clock className="w-3 h-3 text-mfs-mint" />
          <span>Simulação Temporal ForeSig™</span>
        </div>
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg w-64 md:w-80 pointer-events-auto">
           <span className="text-[10px] text-gray-500 font-bold">AGORA</span>
           <div className="relative flex-1 h-8 flex items-center">
              <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                 <div className="w-[50%] h-full bg-gradient-to-r from-mfs-mint to-mfs-lime"></div>
              </div>
              <div className="absolute left-[50%] top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-mfs-lime rounded-full shadow-[0_0_15px_#CCFF00] border-2 border-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"></div>
              <div className="absolute left-[50%] -top-3 -translate-x-1/2 text-[10px] font-bold text-mfs-lime bg-black/80 px-1.5 rounded border border-mfs-lime/30 whitespace-nowrap">
                PREVISÃO +45 DIAS
              </div>
           </div>
           <span className="text-[10px] text-gray-500 font-bold">+90D</span>
        </div>
      </div>

      <svg width={dimensions.width} height={dimensions.height} className="absolute inset-0 z-10 pointer-events-none">
        <defs>
          <filter id="glow-mint" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-danger" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connections */}
        {nodes.length > 0 && nodes.slice(1).map((node, i) => {
          const isRiskyConnection = node.riskScore < 70;
          return (
            <g key={`conn-${i}`}>
              <line
                x1={nodes[0].x}
                y1={nodes[0].y}
                x2={node.x}
                y2={node.y}
                stroke={isRiskyConnection ? '#FF3B30' : "#57D9AE"}
                strokeWidth={isRiskyConnection ? "2" : "1"}
                strokeDasharray={isRiskyConnection ? "4 4" : "0"}
                className={isRiskyConnection ? "animate-dash" : ""}
                opacity={isRiskyConnection ? "0.8" : "0.3"}
              />
              <circle r="3" fill={isRiskyConnection ? "#FF3B30" : "#CCFF00"}>
                <animateMotion
                  dur={`${1.5 + (i % 3) * 0.5}s`}
                  repeatCount="indefinite"
                  path={`M${nodes[0].x},${nodes[0].y} L${node.x},${node.y}`} 
                  keyPoints="0;1" 
                  keyTimes="0;1"
                  calcMode="linear"
                />
                <animate attributeName="opacity" values="0;1;0" dur={`${1.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isRiskyNode = node.riskScore < 70;
          return (
          <g 
            key={node.id} 
            className="cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity pointer-events-auto"
            onMouseDown={(e) => handleMouseDown(e, node.id, node.x, node.y)}
          >
            {/* Outer Glow Ring for Hub */}
            {node.type === 'HUB' && (
               <circle
               cx={node.x}
               cy={node.y}
               r={node.size + 15}
               stroke="#57D9AE"
               strokeWidth="1"
               fill="none"
               opacity="0.3"
               style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: 'spin 10s linear infinite' }}
             />
            )}

            {/* Risky Node Highlight Ring */}
            {isRiskyNode && node.type === 'SATELLITE' && (
                 <circle
                 cx={node.x}
                 cy={node.y}
                 r={node.size + 8}
                 stroke="#FF3B30"
                 strokeWidth="1"
                 fill="none"
                 opacity="0.6"
                 className="animate-pulse"
               />
            )}

            {/* Main Node Circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill={node.type === 'HUB' ? '#0F1218' : (isRiskyNode ? '#1a0505' : '#1E293B')}
              stroke={node.type === 'HUB' ? '#57D9AE' : (isRiskyNode ? '#FF3B30' : '#94A3B8')}
              strokeWidth={node.type === 'HUB' ? 2 : (isRiskyNode ? 3 : 1)}
              filter={node.type === 'HUB' ? 'url(#glow-mint)' : (isRiskyNode ? 'url(#glow-danger)' : '')}
            />

            {/* Inner Design */}
            {node.type === 'HUB' && (
              <circle cx={node.x} cy={node.y} r={node.size - 10} fill="#57D9AE" opacity="0.1" />
            )}

            {/* Labels */}
            <text
              x={node.x}
              y={node.y + node.size + 15}
              textAnchor="middle"
              fill={isRiskyNode ? "#FF3B30" : "#94A3B8"}
              fontWeight={isRiskyNode ? "bold" : "normal"}
              fontSize="12"
              fontFamily="JetBrains Mono"
              className="pointer-events-none select-none"
            >
              {node.label}
            </text>

            {/* FINANCIAL EXPOSURE LABEL */}
            {node.exposure && (
              <text
                x={node.x}
                y={node.y + node.size + 28}
                textAnchor="middle"
                fill={isRiskyNode ? "#FF3B30" : "#64748B"}
                fontSize={isRiskyNode ? "11" : "10"}
                fontWeight={isRiskyNode ? "bold" : "normal"}
                fontFamily="JetBrains Mono"
                className="pointer-events-none select-none tracking-wider"
                filter={isRiskyNode ? "drop-shadow(0px 0px 4px rgba(255, 59, 48, 0.5))" : ""}
              >
                {node.exposure}
              </text>
            )}

            {/* Watchlist Badge for Hub */}
            {node.type === 'HUB' && (
                <g transform={`translate(${node.x + 50}, ${node.y - 30})`}>
                   <rect x="0" y="0" width="110" height="16" rx="4" fill="rgba(255, 204, 0, 0.2)" stroke="rgba(255, 204, 0, 0.6)" strokeWidth="1" />
                   <text x="55" y="11" textAnchor="middle" fill="#FFCC00" fontSize="9" fontFamily="Inter" fontWeight="bold">LISTA DE ATENÇÃO</text>
                </g>
            )}

            {/* Risk Score inside Satellite */}
            {node.type === 'SATELLITE' && (
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fill={isRiskyNode ? '#FF3B30' : 'white'}
                fontSize={isRiskyNode ? "14" : "10"}
                fontWeight="bold"
                fontFamily="JetBrains Mono"
                className="pointer-events-none select-none"
              >
                {node.riskScore}
              </text>
            )}
          </g>
          );
        })}
      </svg>
      
      {/* Floating Hub Label UI Overlay - Now Draggable */}
      <div 
        className="absolute z-20 bg-mfs-glass border border-mfs-mint/30 backdrop-blur-md px-3 py-1 rounded text-mfs-mint font-mono text-xs cursor-grab active:cursor-grabbing hover:bg-mfs-mint/10 transition-colors group"
        style={{ left: hubLabelPos.x, top: hubLabelPos.y }}
        onMouseDown={(e) => handleMouseDown(e, 'hub-label', hubLabelPos.x, hubLabelPos.y)}
      >
        <div className="flex items-center gap-2 pointer-events-none">
           <span>SCORE DE RISCO HUB: 94</span>
           <GripHorizontal className="w-3 h-3 text-mfs-mint/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      
      {/* Topology Legend/Status (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-1 pointer-events-none">
          <div className="flex items-center gap-2 text-xs text-mfs-text font-mono">
              <span className="w-2 h-2 rounded-full bg-mfs-red animate-pulse"></span>
              1 Exposição de Alto Risco
          </div>
          <div className="flex items-center gap-2 text-xs text-mfs-text font-mono">
              <span className="w-2 h-2 rounded-full bg-mfs-mint"></span>
              7 Conexões Saudáveis
          </div>
      </div>
    </div>
  );
};

export default NetworkGraph;