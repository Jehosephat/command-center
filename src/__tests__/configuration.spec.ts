import configuration from '../config/configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear relevant env vars
    delete process.env.PORT;
    delete process.env.GALACHAIN_ENV;
    delete process.env.GALACHAIN_GATEWAY_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('should return default values when no environment variables are set', () => {
      const config = configuration();

      expect(config.port).toBe(3000);
      expect(config.galachain.env).toBe('stage');
      expect(config.galachain.gatewayUrl).toBe('https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract');
    });
  });

  describe('PORT validation', () => {
    it('should parse PORT from environment', () => {
      process.env.PORT = '8080';
      const config = configuration();
      expect(config.port).toBe(8080);
    });

    it('should reject invalid PORT (non-numeric)', () => {
      process.env.PORT = 'invalid';
      expect(() => configuration()).toThrow('Invalid PORT');
    });

    it('should reject PORT out of range (too high)', () => {
      process.env.PORT = '70000';
      expect(() => configuration()).toThrow('Invalid PORT');
    });

    it('should reject PORT out of range (zero)', () => {
      process.env.PORT = '0';
      expect(() => configuration()).toThrow('Invalid PORT');
    });

    it('should reject PORT out of range (negative)', () => {
      process.env.PORT = '-1';
      expect(() => configuration()).toThrow('Invalid PORT');
    });
  });

  describe('GALACHAIN_ENV validation', () => {
    it('should accept "stage" environment', () => {
      process.env.GALACHAIN_ENV = 'stage';
      const config = configuration();
      expect(config.galachain.env).toBe('stage');
    });

    it('should accept "production" environment', () => {
      process.env.GALACHAIN_ENV = 'production';
      const config = configuration();
      expect(config.galachain.env).toBe('production');
    });

    it('should accept case-insensitive environment names', () => {
      process.env.GALACHAIN_ENV = 'PRODUCTION';
      const config = configuration();
      expect(config.galachain.env).toBe('production');
    });

    it('should reject invalid environment', () => {
      process.env.GALACHAIN_ENV = 'invalid';
      expect(() => configuration()).toThrow('Invalid GALACHAIN_ENV');
    });
  });

  describe('URL validation', () => {
    it('should accept valid GALACHAIN_GATEWAY_URL', () => {
      process.env.GALACHAIN_GATEWAY_URL = 'https://custom-gateway.example.com';
      const config = configuration();
      expect(config.galachain.gatewayUrl).toBe('https://custom-gateway.example.com');
    });

    it('should reject invalid GALACHAIN_GATEWAY_URL', () => {
      process.env.GALACHAIN_GATEWAY_URL = 'not-a-url';
      expect(() => configuration()).toThrow('Invalid GALACHAIN_GATEWAY_URL');
    });
  });

  describe('environment-based defaults', () => {
    it('should use stage defaults when GALACHAIN_ENV is stage', () => {
      process.env.GALACHAIN_ENV = 'stage';
      const config = configuration();
      expect(config.galachain.gatewayUrl).toBe('https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract');
    });

    it('should use production defaults when GALACHAIN_ENV is production', () => {
      process.env.GALACHAIN_ENV = 'production';
      const config = configuration();
      expect(config.galachain.gatewayUrl).toBe('https://gateway-mainnet.galachain.com/api/asset/token-contract');
    });

    it('should allow overriding defaults with explicit URLs', () => {
      process.env.GALACHAIN_ENV = 'production';
      process.env.GALACHAIN_GATEWAY_URL = 'https://custom-gateway.example.com';

      const config = configuration();

      expect(config.galachain.env).toBe('production');
      expect(config.galachain.gatewayUrl).toBe('https://custom-gateway.example.com');
    });
  });
});
