import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GalaChainSignerService } from '../galachain-signer.service';

// A test private key (DO NOT use in production)
const TEST_PRIVATE_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const TEST_ADDRESS = 'eth|testaddress';

describe('GalaChainSignerService', () => {
  let service: GalaChainSignerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalaChainSignerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                'fulfiller.privateKey': TEST_PRIVATE_KEY,
                'fulfiller.address': TEST_ADDRESS,
              };
              return config[key] ?? defaultValue;
            },
          },
        },
      ],
    }).compile();

    service = module.get<GalaChainSignerService>(GalaChainSignerService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report as configured', () => {
    expect(service.isConfigured).toBe(true);
  });

  it('should return the fulfiller address', () => {
    expect(service.fulfillerAddress).toBe(TEST_ADDRESS);
  });

  describe('generateUniqueKey', () => {
    it('should return a non-empty string', () => {
      const key = service.generateUniqueKey();
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('should generate unique keys', () => {
      const keys = new Set(Array.from({ length: 10 }, () => service.generateUniqueKey()));
      expect(keys.size).toBe(10);
    });
  });

  describe('signDto', () => {
    it('should add a signature field to the DTO', () => {
      const dto = { foo: 'bar', quantity: '10' };
      const signed = service.signDto(dto);

      expect(signed).toHaveProperty('signature');
      expect(typeof signed.signature).toBe('string');
      expect(signed.signature.length).toBeGreaterThan(0);
    });

    it('should preserve original DTO fields', () => {
      const dto = { foo: 'bar', quantity: '10' };
      const signed = service.signDto(dto);

      expect(signed.foo).toBe('bar');
      expect(signed.quantity).toBe('10');
    });

    it('should produce a base64-encoded signature', () => {
      const dto = { test: 'value' };
      const signed = service.signDto(dto);

      // Base64 characters only
      expect(signed.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should produce deterministic signatures for the same input', () => {
      const dto = { a: '1', b: '2' };
      const sig1 = service.signDto(dto).signature;
      const sig2 = service.signDto(dto).signature;

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different inputs', () => {
      const sig1 = service.signDto({ value: '1' }).signature;
      const sig2 = service.signDto({ value: '2' }).signature;

      expect(sig1).not.toBe(sig2);
    });

    it('should strip existing signature before signing', () => {
      const dto = { foo: 'bar', signature: 'old-sig' };
      const signed = service.signDto(dto);

      // The new signature should be computed without the old one
      const cleanDto = { foo: 'bar' };
      const cleanSigned = service.signDto(cleanDto);

      expect(signed.signature).toBe(cleanSigned.signature);
    });
  });

  describe('buildSignedMintDto', () => {
    it('should build a valid signed mint DTO', () => {
      const tokenClass = {
        collection: 'TestCollection',
        category: 'Item',
        type: 'Sword',
        additionalKey: 'Rare',
      };
      const signed = service.buildSignedMintDto(tokenClass, 'eth|buyer', '5');

      expect(signed).toHaveProperty('tokenClass', tokenClass);
      expect(signed).toHaveProperty('tokenInstance', '0');
      expect(signed).toHaveProperty('owner', 'eth|buyer');
      expect(signed).toHaveProperty('quantity', '5');
      expect(signed).toHaveProperty('uniqueKey');
      expect(signed).toHaveProperty('signature');
    });
  });

  describe('buildSignedTransferDto', () => {
    it('should build a valid signed transfer DTO', () => {
      const tokenInstance = {
        collection: 'GALA',
        category: 'Unit',
        type: 'none',
        additionalKey: 'none',
        instance: '0',
      };
      const signed = service.buildSignedTransferDto(
        'eth|from',
        'eth|to',
        tokenInstance,
        '100',
      );

      expect(signed).toHaveProperty('from', 'eth|from');
      expect(signed).toHaveProperty('to', 'eth|to');
      expect(signed).toHaveProperty('tokenInstance', tokenInstance);
      expect(signed).toHaveProperty('quantity', '100');
      expect(signed).toHaveProperty('uniqueKey');
      expect(signed).toHaveProperty('signature');
    });
  });

  describe('when not configured', () => {
    let unconfiguredService: GalaChainSignerService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GalaChainSignerService,
          {
            provide: ConfigService,
            useValue: {
              get: (_key: string, defaultValue?: string) => defaultValue ?? '',
            },
          },
        ],
      }).compile();

      unconfiguredService = module.get<GalaChainSignerService>(GalaChainSignerService);
      unconfiguredService.onModuleInit();
    });

    it('should report as not configured', () => {
      expect(unconfiguredService.isConfigured).toBe(false);
    });

    it('should throw when signing without a key', () => {
      expect(() => unconfiguredService.signDto({ test: '1' })).toThrow(
        'Fulfiller wallet not configured',
      );
    });
  });
});
