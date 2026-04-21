const API_BASE_URL = "http://localhost:8000/v1";

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
    exposure: string;
    risk: string;
    color: string;
  }[];
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
