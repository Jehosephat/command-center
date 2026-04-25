/**
 * Client configuration loaded from environment variables
 */

export type GalaChainEnv = 'production' | 'stage';

export interface GalaChainConfig {
  env: GalaChainEnv;
  gatewayUrl: string;
}

export interface AppConfig {
  apiBaseUrl: string;
  galachain: GalaChainConfig;
}

const GALACHAIN_DEFAULTS: Record<GalaChainEnv, { gatewayUrl: string }> = {
  production: {
    gatewayUrl: 'https://gateway-mainnet.galachain.com/api/asset/token-contract',
  },
  stage: {
    gatewayUrl: 'https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract',
  },
};

/**
 * Validates the GalaChain environment value
 */
function getGalaChainEnv(): GalaChainEnv {
  const value = import.meta.env.VITE_GALACHAIN_ENV;
  if (!value) {
    return 'stage'; // default to stage
  }
  const normalized = value.toLowerCase() as GalaChainEnv;
  if (normalized !== 'production' && normalized !== 'stage') {
    console.warn(
      `Invalid VITE_GALACHAIN_ENV: "${value}". Using "stage" as default.`,
    );
    return 'stage';
  }
  return normalized;
}

/**
 * Validates a URL string or returns default
 */
function getUrl(envValue: string | undefined, defaultValue: string): string {
  if (!envValue) {
    return defaultValue;
  }
  try {
    new URL(envValue);
    return envValue;
  } catch {
    console.warn(`Invalid URL "${envValue}". Using default: ${defaultValue}`);
    return defaultValue;
  }
}

function createConfig(): AppConfig {
  const galachainEnv = getGalaChainEnv();
  const defaults = GALACHAIN_DEFAULTS[galachainEnv];

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
    galachain: {
      env: galachainEnv,
      gatewayUrl: getUrl(
        import.meta.env.VITE_GALACHAIN_GATEWAY_URL,
        defaults.gatewayUrl,
      ),
    },
  };
}

export const config: AppConfig = createConfig();
