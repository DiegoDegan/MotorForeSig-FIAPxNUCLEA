const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/v1";

// For MVP, we can hardcode the credentials from the documentation or just fetch if no auth is strictly enforced during local dev.
// The backend requires a token for getting portfolio summary and credit pipeline.
// In a real scenario, we'd handle login and store the token.
let CACHED_TOKEN = "";

export const login = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Default MVP mock credentials
      body: new URLSearchParams({
        username: 'admin_mfs',
        password: 'nuclea_segura_2024'
      })
    });
    const data = await response.json();
    if (data.access_token) {
      CACHED_TOKEN = data.access_token;
      return true;
    }
    return false;
  } catch (error) {
    console.error("Login failed", error);
    return false;
  }
};

const fetchWithAuth = async (url: string) => {
  if (!CACHED_TOKEN) {
    await login();
  }
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Authorization': `Bearer ${CACHED_TOKEN}`
    }
  });
  if (response.status === 401) {
    // try to login again once
    await login();
    const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Authorization': `Bearer ${CACHED_TOKEN}`
      }
    });
    return retryResponse;
  }
  return response;
};

export interface PortfolioSummary {
  psi_global: number;
  total_exposed_value: number;
  el_sum: number;
  drift_alerts: number;
  avg_delay: number;
  avg_liquidity: number;
  cnae_labels: string[];
  cnae_data: number[];
  rejection_labels: string[];
  rejection_data: number[];
  recommended_actions: string[];
  top_exposures: {
    entity: string;
    exposure: number;
    risk: string;
    color: string;
  }[];
  // Tela 1 — Visão Geral
  vme: number;
  ticket_medio: number;
  volume_baixa: number;
  inadimplencia_pct: number;
  cnpjs_ativos: number;
  status_labels: string[];
  status_data: number[];
  monthly_chart: { mes: string; no_prazo: number; com_atraso: number }[];
  score_materialidade_media: number;
  hhi_setorial: number;
  top_pagadores_pareto: { id: string; valor: number; acumulado_pct: number }[];
  liquidez_por_setor: { setor: string; liquidez: number }[];
  exposicao_por_uf: { uf: string; valor: number }[];
}

export const getPortfolioSummary = async (riskBand?: string): Promise<PortfolioSummary | null> => {
  try {
    const url = riskBand ? `/portfolio/summary?risk_band=${riskBand}` : "/portfolio/summary";
    const response = await fetchWithAuth(url);
    if (!response.ok) throw new Error("Failed to fetch summary");
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const getCreditPipeline = async () => {
  try {
    const response = await fetchWithAuth("/credit/pipeline");
    if (!response.ok) throw new Error("Failed to fetch pipeline");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getSystemicRisk = async () => {
  try {
    const response = await fetchWithAuth("/systemic/risk");
    if (!response.ok) throw new Error("Failed to fetch systemic risk");
    return await response.json();
  } catch (error) {
    console.error(error);
    return { nodes: [], links: [], top_networks: [] };
  }
};

export interface PipelineOperation {
  id_boleto: string;
  cedente: string;
  cedente_id: string;
  sacado_nome_fantasia: string;
  valor_nominal: number;
  score_pd: number;
  valor_esperado_perda: number;
  acao_sugerida: string;
  justificativa_mesa: { name: string; value: number }[];
  cedente_exposicao: number;
  risco_contagio: boolean;
}


export interface PDSummary {
  el_total: number;
  pd_media: number;
  lgd_media: number;
  provisao_sugerida: number;
  el_por_faixa: { faixa: string; el: number; pd_media: number; count: number }[];
  scatter_data: { id: string; exposicao: number; pd: number; el: number }[];
  el_por_uf: { uf: string; el: number; pd_media: number; count: number }[];
}

export const getPDSummary = async (): Promise<PDSummary | null> => {
  try {
    const response = await fetchWithAuth("/pd/summary");
    if (!response.ok) throw new Error("Failed to fetch PD summary");
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export interface PoliticaSummary {
  taxa_aprovacao: number;
  taxa_rejeicao: number;
  capital_preservado: number;
  falso_positivo_pct: number;
  el_economizado: number;
  impact_curve: { threshold: number; receita_pct: number; inadimplencia_pct: number; n_aprovado: number }[];
  heatmap_data: { score_bin: string; liq_bin: string; default_rate: number; count: number; atraso_medio: number }[];
  heatmap_score_bins: string[];
  heatmap_liq_bins: string[];
  contagio_curve: { tol: number; pagerank_threshold: number; n_blocked: number; valor_blocked: number; el_blocked: number }[];
}

export const getPoliticaSummary = async (): Promise<PoliticaSummary | null> => {
  try {
    const response = await fetchWithAuth("/politica/summary");
    if (!response.ok) throw new Error("Failed to fetch politica summary");
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const getGovernanceMetrics = async () => {
  try {
    const response = await fetchWithAuth("/governance/metrics");
    if (!response.ok) throw new Error("Failed to fetch governance");
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

export interface PipelineReportItem {
  // identifiers & dates
  id_boleto: string;
  id_pagador: string;
  id_beneficiario?: string | null;
  dt_emissao?: string | null;
  dt_vencimento?: string | null;
  dt_pagamento?: string | null;
  // financial
  vlr_nominal: number;
  vlr_baixa?: number | null;
  tipo_baixa?: string | null;
  tipo_especie?: string | null;
  // cadastral
  id_cnpj?: string | null;
  cd_cnae_prin?: string | null;
  uf?: string | null;
  // features de risco
  sacado_indice_liquidez_1m?: number | null;
  cedente_indice_liquidez_1m?: number | null;
  score_materialidade_evolucao?: number | null;
  media_atraso_dias?: number | null;
  indicador_liquidez_quantitativo_3m?: number | null;
  share_vl_inad_pag_bol_6_a_15d?: number | null;
  score_quantidade_v2?: number | null;
  score_materialidade_v2?: number | null;
  atraso_previsto_dias?: number | null;
  // métricas de crédito
  PD: number;
  LGD?: number | null;
  EL: number;
  // decisão
  STATUS_FINAL: string;
  MOTIVO_DECISAO?: string | null;
  // aliases legados para compatibilidade com a tabela do dashboard
  score_pd: number;
  perda_el: number;
  decisao: string;
}

export const getPipelineReport = async (): Promise<PipelineReportItem[]> => {
  try {
    const response = await fetchWithAuth("/pipeline/report");
    if (!response.ok) throw new Error("Failed to fetch pipeline report");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const recordOperationAction = async (id_boleto: string, action: string, reason: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/credit/operations/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CACHED_TOKEN}`
      },
      body: JSON.stringify({ id_boleto, action, reason })
    });
    return response.ok;
  } catch (error) {
    console.error(error);
    return false;
  }
};

