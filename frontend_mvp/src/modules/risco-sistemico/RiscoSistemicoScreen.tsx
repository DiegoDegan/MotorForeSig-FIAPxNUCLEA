import React, { useState, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { X, ShieldAlert } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TopNav, BentoCell } from '../../components/shared';
import { getSystemicRisk, getGovernanceMetrics } from '../../services/api';

const SidePanel = ({ title, children, className = "" }: any) => (
  <div className={`w-full bg-surface border border-white/5 rounded-lg flex flex-col ${className}`}>
    <div className="border-b border-white/5 px-3 py-2">
      <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{title}</div>
    </div>
    <div className="flex-1 p-3">
      {children}
    </div>
  </div>
);



// ─── Kaplan-Meier (movida de GovernancaScreen) ───────────────────────────────
const KaplanMeierChart = ({ kmData, className = "" }: { kmData: any[], className?: string }) => {
  const CustomTooltipKM = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-obsidian/90 border border-white/20 p-2 font-mono text-xs">
        <div className="text-white/50 mb-1">ATRASO: <span className="text-white">{label} DIAS</span></div>
        <div className="text-mint">% NÃO LIQUIDADO: <span className="font-bold text-white">{(payload[0].value * 100).toFixed(1)}%</span></div>
      </div>
    );
  };

  return (
    <BentoCell
      title="Curva de Sobrevivência e Tempo até Liquidação"
      tooltip="Estima a probabilidade de liquidação do ativo ao longo do tempo (tempo até liquidação)."
      className={`h-[400px] lg:h-full ${className}`}
    >
      <div className="mt-4 flex h-full w-full pb-6 pl-2">
        {/* Barra de Score lateral (Legenda) */}
        <div className="flex flex-col items-center justify-start mr-8 h-[85%] mt-4">
          <div className="text-xs text-white/50 mb-2 font-mono">Score</div>
          <div className="relative w-4 flex-1 rounded-sm" style={{ background: 'linear-gradient(to bottom, #4ade80, #eab308, #ef4444)' }}>
            <div className="absolute top-[10%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">900</div>
            <div className="absolute top-[26%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">800</div>
            <div className="absolute top-[42%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">700</div>
            <div className="absolute top-[58%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">600</div>
            <div className="absolute top-[74%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">500</div>
            <div className="absolute top-[90%] left-6 text-xs text-white/50 font-mono -translate-y-1/2">400</div>
          </div>
        </div>

        {/* Gráfico principal */}
        <div className="flex-1 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kmData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="days"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                label={{ value: 'Dias após vencimento', position: 'insideBottom', offset: -15,
                         fill: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace' }}
              />
              <YAxis
                domain={[0, 1]}
                tickCount={6}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                tickFormatter={v => v.toString()}
                label={{ value: '% Boletos NÃO liquidados', angle: -90, position: 'insideLeft', offset: 15,
                         fill: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace' }}
              />
              <Tooltip content={<CustomTooltipKM />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
              <Line
                type="monotone"
                dataKey="probability"
                stroke="#a3e635"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#a3e635', stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </BentoCell>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export const RiscoSistemicoScreen = () => {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [], top_networks: [] });
  const [loading, setLoading] = useState(true);
  const [exposureThreshold, setExposureThreshold] = useState(0);
  const [kmData, setKmData] = useState<any[]>([]);

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
      const [systemic, governance] = await Promise.all([
        getSystemicRisk(),
        getGovernanceMetrics(),
      ]);
      if (systemic) {
        setGraphData(systemic);
        if (systemic.nodes.length > 0) setSelectedNode(systemic.nodes[0]);
      }
      if (governance?.km_data) setKmData(governance.km_data);
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
      <TopNav title="RISCO SISTÊMICO" subtitle="MAPEAMENTO DE CONTÁGIO SISTÊMICO" />

      <div className="flex flex-col gap-6 mt-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
          <BentoCell 
            title="Nós Críticos (>5 cedentes)" 
            tooltip="Número de sacados que possuem conexão com mais de 5 cedentes diferentes, indicando pontos de alta sensibilidade na rede."
          >
            <div className="text-3xl font-mono font-bold text-white mt-2">14</div>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Sacados com alta conectividade</div>
          </BentoCell>
          <BentoCell 
            title="Grau Médio de Conectividade"
            tooltip="Média de conexões (edges) por empresa no grafo. Valores altos indicam uma carteira mais interdependente e propensa a contágio."
          >
            <div className="text-3xl font-mono font-bold text-white mt-2">1.14</div>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Conexões médias por empresa</div>
          </BentoCell>
          <BentoCell 
            title="Eficiência de Back-Office e Liquidação"
            tooltip="Prazo médio decorrido entre a data de vencimento e a liquidação efetiva do título para ativos que sofreram atraso."
          >
            <div className="text-3xl font-mono font-bold text-white mt-2">4.7 <span className="text-base font-normal text-white/50">dias</span></div>
            <div className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">Dias até baixa após vencimento</div>
          </BentoCell>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[600px] xl:h-[520px]">
          {/* LADO ESQUERDO: Grafo e Controles — 6/12 */}
          <div className="xl:col-span-6 flex gap-2 h-full">
            {/* Mapa (flex-1 para encolher e dar espaço aos controles) */}
            <div className="flex-1 min-h-[500px] h-full relative bg-surface border border-white/5 rounded-lg overflow-hidden" ref={graphContainerRef}>
              <div className="absolute top-4 left-4 z-50 pointer-events-none">
                <h3 className="text-white/70 font-mono text-sm tracking-widest uppercase bg-obsidian/80 px-2 py-1">Grafo de Risco - Top conexões financeiras</h3>
              </div>
              <div className="absolute inset-0 z-20 cursor-move">
              {dimensions.width > 0 && (
                <ForceGraph2D
                  ref={graphRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  graphData={filteredGraphData}
                  minZoom={0.1}
                  maxZoom={10}
                  nodeRelSize={6.4}
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

              <div className="absolute bottom-4 left-4 z-50 bg-obsidian/80 backdrop-blur-md border border-white/20 p-4 font-mono text-xs shadow-xl">
                <div className="text-white">DADOS REAIS: {graphData.nodes.length} ENTIDADES</div>
                <div className="text-heat/80 uppercase font-bold mt-1">Nós mais perigosos</div>
              </div>
            </div>

            {/* SIDE CONTROLS (AGORA FORA DO MAPA, MAIS ESTREITOS E ESTICADOS) */}
            <div className="w-[220px] flex flex-col gap-2 overflow-y-auto shrink-0 custom-scrollbar h-full">
              <SidePanel title="FILTRO DE EXPOSIÇÃO">
                <div className="flex justify-between text-xs font-mono text-white/60 mb-2">
                  <span>LIMITE:</span>
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
                <div className="text-xs font-mono text-white/30 uppercase leading-tight">
                  * Filtra nós com valor nominal abaixo do threshold.
                </div>
              </SidePanel>

              {selectedNode && (
                <SidePanel title="INSPEÇÃO DE NÓ" className="flex-1 overflow-hidden">
                  <h3 className={`text-base font-mono font-bold mb-1 truncate ${selectedNode.avg_payer_risk > 0.6 ? 'text-heat' : 'text-white'}`}>{selectedNode.name}</h3>
                  <div className="text-xs font-mono text-white/40 mb-4 uppercase tracking-tighter truncate">EXPOSIÇÃO: {selectedNode.value}</div>

                  <div className="space-y-4 font-mono text-xs">
                    <div className="border-t border-white/5 pt-3">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-mint truncate mr-1">PAGERANK</span>
                        <span>{selectedNode.pagerank.toFixed(4)}</span>
                      </div>
                      <p className="text-xs text-white/30 leading-snug italic">Criticidade do nó.</p>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-heat truncate mr-1">SCORE RISCO</span>
                        <span>{selectedNode.avg_payer_risk.toFixed(4)}</span>
                      </div>
                      <p className="text-xs text-white/30 leading-snug italic">PD média do cluster.</p>
                    </div>
                  </div>
                </SidePanel>
              )}
            </div>
          </div>

          {/* SEPARADOR VISUAL — col 7 fica vazio, criando vão entre grafo e KM */}

          {/* CURVA DE SOBREVIVÊNCIA — 5/12, começa na col 8 */}
          <div className="xl:col-span-5 xl:col-start-8 flex flex-col h-full min-h-[500px]">
            {kmData.length > 0 ? (
              <KaplanMeierChart kmData={kmData} />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-obsidian/40 border border-white/5 text-white/40 font-mono text-xs">
                CARREGANDO CURVA...
              </div>
            )}
          </div>

        </div>

        {/* TOP 10 REDES CONECTADAS */}
        <BentoCell 
          title="Clusters de Criticidade Máxima" 
          icon={ShieldAlert}
          tooltip="Agrupamento de empresas (clusters) conectadas por relações financeiras. Redes com alta Perda Esperada sinalizam que a quebra de uma entidade pode desencadear inadimplência em cascata no grupo."
        >
          <div className="text-xs font-mono text-white/40 uppercase tracking-widest mb-6 -mt-2">
            Ordenadas por perda esperada (Exposição Total do Cluster)
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {graphData.top_networks?.map((network: any) => (
              <div key={network.id} className="bg-surface-high border border-white/5 rounded-lg p-4 hover:border-mint/30 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-white/40 uppercase tracking-widest">{network.id}</span>
                  <span className={`text-xs font-mono px-1.5 py-0.5 ${(() => {
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
                    {network.edges_count} <span className="text-xs text-white/40 font-normal">CONEXÕES</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-2">
                    <div className="text-xs font-mono text-white/60 flex justify-between">
                      <span>EXPOSIÇÃO:</span>
                      <span className="text-white">R$ {(network.total_exposure / 1e6).toFixed(1)}M</span>
                    </div>
                    <div className="text-xs font-mono text-heat/80 font-bold flex justify-between border-t border-white/5 pt-1">
                      <span>PERDA ESPERADA:</span>
                      <span>R$ {(network.expected_loss / 1e6).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-mono text-white/30 uppercase mb-1">Principais Entidades:</div>
                  {network.main_entities.map((entity: string, idx: number) => (
                    <div key={idx} className="text-xs font-mono text-white/70 flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${entity.startsWith('ANC') ? 'bg-mint' : 'bg-white/40'}`} />
                      {entity}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </BentoCell>


      </div>
    </div>
  );
};
