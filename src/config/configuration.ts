/**
 * NestJS configuration factory
 * Loads and validates environment variables
 */

export type GalaChainEnv = 'production' | 'stage';

export interface AppConfiguration {
  port: number;
  galachain: {
    env: GalaChainEnv;
    gatewayUrl: string;
  };
  fulfiller: {
    privateKey: string;
    address: string;
  };
  platform: {
    feePercent: number;
  };
  database: {
    path: string;
  };
}

const GALACHAIN_DEFAULTS: Record<GalaChainEnv, { gatewayUrl: string }> = {
  production: {
    gatewayUrl: 'https://gateway-mainnet.galachain.com/api/asset/token-contract',
  },
  stage: {
    gatewayUrl: 'https://gateway-testnet.galachain.com/api/testnet01/gc-a9b8b472b035c0510508c248d1110d3162b7e5f4-GalaChainToken',
  },
};

/**
 * Validates the GalaChain environment value
 */
function validateGalaChainEnv(value: string | undefined): GalaChainEnv {
  if (!value) {
    return 'stage'; // default to stage
  }
  const normalized = value.toLowerCase() as GalaChainEnv;
  if (normalized !== 'production' && normalized !== 'stage') {
    throw new Error(
      `Invalid GALACHAIN_ENV: "${value}". Must be "production" or "stage".`,
    );
  }
  return normalized;
}

/**
 * Validates a URL string
 */
function validateUrl(name: string, value: string | undefined, defaultValue: string): string {
  const url = value || defaultValue;
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`Invalid ${name}: "${value}" is not a valid URL.`);
  }
}

/**
 * Configuration factory function for NestJS ConfigModule
 */
export default function configuration(): AppConfiguration {
  const galachainEnv = validateGalaChainEnv(process.env.GALACHAIN_ENV);
  const defaults = GALACHAIN_DEFAULTS[galachainEnv];

  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: "${process.env.PORT}". Must be a number between 1 and 65535.`,
    );
  }

  const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '2.5');
  if (isNaN(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new Error(
      `Invalid PLATFORM_FEE_PERCENT: "${process.env.PLATFORM_FEE_PERCENT}". Must be a number between 0 and 100.`,
    );
  }

  return {
    port,
    galachain: {
      env: galachainEnv,
      gatewayUrl: validateUrl(
        'GALACHAIN_GATEWAY_URL',
        process.env.GALACHAIN_GATEWAY_URL,
        defaults.gatewayUrl,
      ),
    },
    fulfiller: {
      privateKey: process.env.FULFILLER_PRIVATE_KEY || '',
      address: process.env.FULFILLER_ADDRESS || '',
    },
    platform: {
      feePercent,
    },
    database: {
      path: process.env.DATABASE_PATH || './data/marketplace.sqlite',
    },
  };
}
