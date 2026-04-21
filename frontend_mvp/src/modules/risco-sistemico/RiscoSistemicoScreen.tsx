import React, { useState, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Rnd } from 'react-rnd';
import { X, ShieldAlert } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TopNav } from '../../components/shared';
import { getSystemicRisk } from '../../services/api';

const SidePanel = ({ title, children, className = "" }: any) => (
  <div className={`w-full bg-surface/80 backdrop-blur-xl border border-white/20 bracket-corners rounded-none shadow-2xl flex flex-col ${className}`}>
    <div className="bg-white/5 border-b border-white/10 p-2">
      <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{title}</div>
    </div>
    <div className="flex-1 p-3">
      {children}
    </div>
  </div>
);

const CustomScatterShape = (props: any) => {
  const { cx, cy, fill, stroke, strokeWidth, payload, style } = props;
  const r = props.node?.r || props.r || 10;

  return (
    <g style={style}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
};

const RiskBubbleChart = ({ data, onNodeHover, hoveredNodeId }: any) => {
  const chartData = data.map((node: any) => {
    const volume = node.total_exposed_value || 0;
    const pageRank = node.pagerank || 0;

    let fill = 'rgba(115, 243, 199, 0.2)';
    let stroke = 'var(--color-mint)';

    if (node.avg_payer_risk > 0.6) {
      fill = 'rgba(255, 113, 98, 0.2)';
      stroke = 'var(--color-heat)';
    }

    return {
      ...node,
      pageRank,
      pageRankIndex: pageRank * 100, // Converte a probabilidade minúscula em um Índice (ex: 0.05 vira 5.0)
      volume: volume / 1000,
      riskPosition: node.avg_payer_risk * 100,
      fill,
      stroke
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-obsidian/90 border border-white/20 p-2 font-mono text-[10px] z-50">
          <div className="text-white font-bold">{data.name}</div>
          <div className="text-white/60">ÍNDICE INFLUÊNCIA: {data.pageRankIndex.toFixed(2)}</div>
          <div className="text-white/60">VOLUME: {data.value}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full relative flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[10px] font-mono text-mint tracking-widest">
          DISTRIBUIÇÃO REAL: ÍNDICE DE INFLUÊNCIA (PAGERANK SCALED) VS EXPOSIÇÃO
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            {/* Domínio automático espalha os nós ao longo de todo o eixo X, evitando o achatamento no 0 */}
            <XAxis type="number" dataKey="pageRankIndex" domain={['dataMin - 0.5', 'auto']} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis type="number" dataKey="riskPosition" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }} />
            <ZAxis type="number" dataKey="volume" range={[50, 800]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={chartData} shape={<CustomScatterShape />} onMouseEnter={(e: any) => onNodeHover && onNodeHover(e.payload.id)} onMouseLeave={() => onNodeHover && onNodeHover(null)}>
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.stroke} strokeWidth={entry.id === hoveredNodeId ? 3 : 1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const RiscoSistemicoScreen = () => {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [], top_networks: [] });
  const [loading, setLoading] = useState(true);
  const [exposureThreshold, setExposureThreshold] = useState(0);

  const [panels, setPanels] = useState({ coords: true, filters: true, details: true, timeline: true });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    const fg = graphRef.current;
    if (fg && dimensions.width > 100 && graphData.nodes.length > 0) {
      // Ajuste de Física: Puxar tudo para mais perto
      try {
        const sim = typeof fg.d3Simulation === 'function' ? fg.d3Simulation() : null;
        if (sim) {
          // Repulsão zerada para permitir proximidade absoluta (zero atrito entre nós)
          fg.d3Force('charge').strength(0);
          // Links extremamente curtos
          fg.d3Force('link').distance(2);
          // Sem força de colisão
          
          sim.alpha(1).restart();
        }
      } catch (e) {
        console.warn("Physics adjustment skipped:", e);
      }

      // Para o cluster (que nasce em 0,0) aparecer na ESQUERDA da tela
      const cameraOffsetX = dimensions.width * 0.15; 
      
      setTimeout(() => {
        if (graphRef.current && typeof graphRef.current.centerAt === 'function') {
          graphRef.current.centerAt(cameraOffsetX, 0, 1000);
        }
      }, 1000);
    }
  }, [graphData.nodes.length, dimensions.width]);

  useEffect(() => {
    const fetchData = async () => {
      const result = await getSystemicRisk();
      if (result) {
        setGraphData(result);
        if (result.nodes.length > 0) setSelectedNode(result.nodes[0]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredGraphData = useMemo(() => {
    const fNodes = graphData.nodes.filter((n: any) => n.total_exposed_value >= exposureThreshold);
    const fNodeIds = new Set(fNodes.map((n: any) => n.id));
    const fLinks = graphData.links.filter((l: any) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return fNodeIds.has(sId) && fNodeIds.has(tId);
    });
    return { nodes: fNodes, links: fLinks };
  }, [graphData, exposureThreshold]);

  useEffect(() => {
    const updateSize = () => {
      if (graphContainerRef.current) {
        const { width, height } = graphContainerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setDimensions(prev => {
            // Só atualiza se a diferença for tangível para evitar re-renders desnecessários
            if (Math.abs(prev.width - width) > 2 || Math.abs(prev.height - height) > 2) {
              return { width, height };
            }
            return prev;
          });
        }
      }
    };

    updateSize(); // Roda imediatamente
    window.addEventListener('resize', updateSize);
    
    // Polling contínuo como fallback robusto para contornar limitações do ResizeObserver no React
    const interval = setInterval(updateSize, 300);

    return () => {
      window.removeEventListener('resize', updateSize);
      clearInterval(interval);
    };
  }, []);

  const togglePanel = (key: keyof typeof panels) => setPanels(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div className="text-white p-8 font-mono animate-pulse uppercase tracking-widest">CARREGANDO GRAFO SISTÊMICO...</div>;

  return (
    <div className="flex flex-col flex-1 pb-10">
      <TopNav title="RISCO SISTÊMICO" subtitle="ANÁLISE CONTÁGIO GRAFO" />

      <div className="flex flex-col gap-6 mt-6">
        <div className="min-h-[600px] h-[75vh] relative bg-obsidian border border-white/10 overflow-hidden" ref={graphContainerRef}>
          <div className="absolute inset-0 z-20 cursor-move">
            {dimensions.width > 0 && (
              <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={filteredGraphData}
                minZoom={0.1} // Permitido muito mais zoom out
                maxZoom={10}
                nodeRelSize={6.4} // Redução de 20% do tamanho fixo estabelecido anteriormente
                nodeLabel="name"
                nodeColor={(node: any) => {
                  if (node.id === hoveredNodeId) return '#ffffff';
                  return node.avg_payer_risk > 0.6 ? '#ff7162' : '#73f3c7';
                }}
                linkColor={() => 'rgba(255, 255, 255, 0.1)'}
                onNodeClick={(node) => setSelectedNode(node)}
                onNodeHover={(node: any) => setHoveredNodeId(node ? node.id : null)}
                backgroundColor="transparent"
                cooldownTicks={100}
              />
            )}
          </div>

          <div className="absolute bottom-4 right-4 z-50 bg-obsidian/80 backdrop-blur-md border border-white/20 p-4 font-mono text-[10px] shadow-xl">
            <div className="text-white">DADOS REAIS: {graphData.nodes.length} ENTIDADES</div>
            <div className="text-heat/80 uppercase font-bold mt-1">Esses são os nós mais perigosos</div>
          </div>

          {/* SIDE CONTROLS PINNED TO RIGHT */}
          <div className="absolute top-4 right-4 z-50 w-[260px] pointer-events-auto flex flex-col gap-4">
            <SidePanel title="FILTRO DE EXPOSIÇÃO">
              <div className="flex justify-between text-[10px] font-mono text-white/60 mb-2">
                <span>LIMITE DE EXPOSIÇÃO:</span>
                <span className="text-mint font-bold">R$ {(exposureThreshold / 1e6).toFixed(1)}M</span>
              </div>
              <input
                type="range"
                min="0"
                max="60000000"
                step="500000"
                value={exposureThreshold}
                onChange={(e) => setExposureThreshold(Number(e.target.value))}
                className="w-full accent-mint h-1 bg-white/10 rounded-lg appearance-none cursor-pointer mb-4"
              />
              <div className="text-[8px] font-mono text-white/30 uppercase leading-tight">
                * Filtra nós com valor nominal abaixo do threshold para reduzir ruído visual.
              </div>
            </SidePanel>

            {selectedNode && (
              <SidePanel title="INSPEÇÃO DE NÓ">
                <h3 className={`text-lg font-mono font-bold mb-1 ${selectedNode.avg_payer_risk > 0.6 ? 'text-heat' : 'text-white'}`}>{selectedNode.name}</h3>
                <div className="text-[10px] font-mono text-white/40 mb-4 uppercase tracking-tighter">EXPOSIÇÃO TOTAL: {selectedNode.value}</div>

                <div className="space-y-4 font-mono text-[10px]">
                  <div className="border-t border-white/5 pt-3">
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-mint">PAGERANK (?)</span>
                      <span>{selectedNode.pagerank.toFixed(4)}</span>
                    </div>
                    <p className="text-[9px] text-white/30 leading-snug italic">Mede a criticidade/influência do nó no contágio da rede.</p>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <div className="flex justify-between font-bold mb-1">
                      <span className="text-heat">SCORE RISCO (?)</span>
                      <span>{selectedNode.avg_payer_risk.toFixed(4)}</span>
                    </div>
                    <p className="text-[9px] text-white/30 leading-snug italic">Probabilidade média de default (PD) agregada no cluster.</p>
                  </div>
                </div>
              </SidePanel>
            )}
          </div>
        </div>

        {/* TOP 10 REDES CONECTADAS - MOVED BELOW GRAPH */}
        <div className="bg-surface/40 backdrop-blur-md border border-white/10 p-6 bracket-corners">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="text-heat w-5 h-5" />
            <h2 className="text-xl font-mono font-bold text-white tracking-tighter uppercase">Mapa de Contágio: Redes mais perigosas</h2>
          </div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-6">
            Ordenadas por perda esperada (Exposição Total do Cluster)
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {graphData.top_networks?.map((network: any) => (
              <div key={network.id} className="bg-obsidian/60 border border-white/5 p-4 hover:border-mint/30 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{network.id}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 ${(() => {
                    const riskPct = Math.round(network.avg_risk * 100);
                    if (riskPct <= 49) return 'bg-mint/20 text-mint';
                    if (riskPct <= 70) return 'bg-yellow-400/20 text-yellow-400';
                    return 'bg-heat/20 text-heat';
                  })()}`}>
                    RISCO: {Math.round(network.avg_risk * 100)}%
                  </span>
                </div>
                
                <div className="mb-4">
                  <div className="text-lg font-mono font-bold text-white mb-1">
                    {network.edges_count} <span className="text-[10px] text-white/40 font-normal">CONEXÕES</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-2">
                    <div className="text-[10px] font-mono text-white/60 flex justify-between">
                      <span>EXPOSIÇÃO:</span>
                      <span className="text-white">R$ {(network.total_exposure / 1e6).toFixed(1)}M</span>
                    </div>
                    <div className="text-[10px] font-mono text-heat/80 font-bold flex justify-between border-t border-white/5 pt-1">
                      <span>PERDA ESPERADA:</span>
                      <span>R$ {(network.expected_loss / 1e6).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-white/30 uppercase mb-1">Principais Entidades:</div>
                  {network.main_entities.map((entity: string, idx: number) => (
                    <div key={idx} className="text-[10px] font-mono text-white/70 flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${entity.startsWith('ANC') ? 'bg-mint' : 'bg-white/40'}`} />
                      {entity}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[350px] h-[40vh] relative bg-obsidian border border-white/10 rounded-none p-4 shrink-0">
          <RiskBubbleChart data={graphData.nodes} onNodeHover={setHoveredNodeId} hoveredNodeId={hoveredNodeId} />
        </div>
      </div>
    </div>
  );
};
