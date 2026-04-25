import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { MarketplaceService } from '../marketplace.service';
import { Listing } from '../entities/listing.entity';
import { Purchase, PurchaseStatus } from '../entities/purchase.entity';
import { GalaChainGatewayService } from '../../galachain/galachain-gateway.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

// Helpers to build test data
function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    creatorAddress: 'eth|creator123',
    collection: 'TestNFT',
    category: 'Item',
    type: 'Sword',
    additionalKey: 'Rare',
    priceAmount: '10',
    priceTokenCollection: 'GALA',
    priceTokenCategory: 'Unit',
    priceTokenType: 'none',
    priceTokenAdditionalKey: 'none',
    maxPerWallet: null,
    totalSupply: 100,
    totalSold: 0,
    platformFeePercent: 2.5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchases: [],
    ...overrides,
  } as Listing;
}

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let listingRepo: jest.Mocked<Repository<Listing>>;
  let purchaseRepo: jest.Mocked<Repository<Purchase>>;
  let gateway: jest.Mocked<GalaChainGatewayService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: getRepositoryToken(Listing),
          useValue: {
            create: jest.fn((dto) => ({ ...dto, id: 'new-id', totalSold: 0, createdAt: new Date(), updatedAt: new Date() })),
            save: jest.fn((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            create: jest.fn((dto) => ({ ...dto, id: 'purchase-1', createdAt: new Date(), updatedAt: new Date() })),
            save: jest.fn((entity) => Promise.resolve(entity)),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: GalaChainGatewayService,
          useValue: {
            submitSignedDto: jest.fn(),
            mintToOwner: jest.fn(),
            transferFromFulfiller: jest.fn(),
            isConfigured: true,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) => {
              if (key === 'platform.feePercent') return 2.5;
              if (key === 'fulfiller.address') return 'eth|fulfiller';
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    listingRepo = module.get(getRepositoryToken(Listing));
    purchaseRepo = module.get(getRepositoryToken(Purchase));
    gateway = module.get(GalaChainGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // Listings
  // ============================================================================

  describe('createListing', () => {
    it('should create and save a listing', async () => {
      const dto = {
        creatorAddress: 'eth|creator',
        collection: 'TestNFT',
        category: 'Item',
        type: 'Sword',
        additionalKey: 'Rare',
        priceAmount: '10',
        priceTokenCollection: 'GALA',
        priceTokenCategory: 'Unit',
        priceTokenType: 'none',
        priceTokenAdditionalKey: 'none',
      };

      const result = await service.createListing(dto);

      expect(listingRepo.create).toHaveBeenCalled();
      expect(listingRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('collection', 'TestNFT');
    });

    it('should use default platform fee if not specified', async () => {
      const dto = {
        creatorAddress: 'eth|creator',
        collection: 'TestNFT',
        category: 'Item',
        type: 'Sword',
        additionalKey: 'Rare',
        priceAmount: '10',
        priceTokenCollection: 'GALA',
        priceTokenCategory: 'Unit',
        priceTokenType: 'none',
        priceTokenAdditionalKey: 'none',
      };

      await service.createListing(dto);

      expect(listingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ platformFeePercent: 2.5 }),
      );
    });
  });

  describe('getListingById', () => {
    it('should return a listing when found', async () => {
      const listing = makeListing();
      listingRepo.findOne.mockResolvedValue(listing);

      const result = await service.getListingById('listing-1');
      expect(result).toBe(listing);
    });

    it('should throw NotFoundException when not found', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.getListingById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateListing', () => {
    it('should update listing fields', async () => {
      const listing = makeListing();
      listingRepo.findOne.mockResolvedValue(listing);

      await service.updateListing('listing-1', {
        creatorAddress: 'eth|creator123',
        priceAmount: '20',
        isActive: false,
      });

      expect(listing.priceAmount).toBe('20');
      expect(listing.isActive).toBe(false);
      expect(listingRepo.save).toHaveBeenCalledWith(listing);
    });

    it('should throw ForbiddenException for wrong creator', async () => {
      const listing = makeListing({ creatorAddress: 'eth|creator123' });
      listingRepo.findOne.mockResolvedValue(listing);

      await expect(
        service.updateListing('listing-1', {
          creatorAddress: 'eth|someone-else',
          isActive: false,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ============================================================================
  // Purchases
  // ============================================================================

  describe('executePurchase', () => {
    const testGatewayUrl = 'https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract';
    const validTransferDto = {
      from: 'eth|buyer',
      to: 'eth|fulfiller',
      tokenInstance: {
        collection: 'GALA',
        category: 'Unit',
        type: 'none',
        additionalKey: 'none',
        instance: '0',
      },
      quantity: '10',
      uniqueKey: 'test-key',
      signature: 'test-sig',
    };

    beforeEach(() => {
      listingRepo.findOne.mockResolvedValue(makeListing());
      gateway.submitSignedDto.mockResolvedValue([]);
      gateway.transferFromFulfiller.mockResolvedValue({});
      gateway.mintToOwner.mockResolvedValue([{ instance: '1' }]);

      // Mock the per-wallet check query builder
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      purchaseRepo.createQueryBuilder.mockReturnValue(mockQb as any);
    });

    it('should execute a successful purchase', async () => {
      const result = await service.executePurchase({
        listingId: 'listing-1',
        quantity: 1,
        buyerAddress: 'eth|buyer',
        signedTransferDto: validTransferDto,
        gatewayUrl: testGatewayUrl,
      });

      expect(result.status).toBe(PurchaseStatus.MINTED);
      expect(gateway.submitSignedDto).toHaveBeenCalledWith('TransferToken', validTransferDto, testGatewayUrl);
      expect(gateway.transferFromFulfiller).toHaveBeenCalled();
      expect(gateway.mintToOwner).toHaveBeenCalled();
    });

    it('should reject purchase on inactive listing', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ isActive: false }));

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: validTransferDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject purchase exceeding supply', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ totalSupply: 5, totalSold: 5 }));

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: validTransferDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if transfer recipient is wrong', async () => {
      const wrongDto = { ...validTransferDto, to: 'eth|wrong-address' };

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: wrongDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if transfer amount is wrong', async () => {
      const wrongDto = { ...validTransferDto, quantity: '999' };

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: wrongDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when fulfiller is not configured', async () => {
      (gateway as any).isConfigured = false;

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: validTransferDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle mint failure after payment', async () => {
      gateway.mintToOwner.mockRejectedValue(new Error('Mint failed'));

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: validTransferDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify that save was called with payment_verified status before the mint attempt
      const savedPurchases = purchaseRepo.save.mock.calls.map((c) => c[0]);
      const verifiedSave = savedPurchases.find(
        (p: any) => p.status === PurchaseStatus.PAYMENT_VERIFIED,
      );
      expect(verifiedSave).toBeDefined();
    });

    it('should check per-wallet limit', async () => {
      listingRepo.findOne.mockResolvedValue(makeListing({ maxPerWallet: 2 }));

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '2' }),
      };
      purchaseRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      await expect(
        service.executePurchase({
          listingId: 'listing-1',
          quantity: 1,
          buyerAddress: 'eth|buyer',
          signedTransferDto: validTransferDto,
          gatewayUrl: testGatewayUrl,
        }),
      ).rejects.toThrow(/per-wallet limit/);
    });

    it('should calculate correct fee split', async () => {
      // Price 10, fee 2.5% = 0.25 fee, 9.75 to seller
      const result = await service.executePurchase({
        listingId: 'listing-1',
        quantity: 1,
        buyerAddress: 'eth|buyer',
        signedTransferDto: validTransferDto,
        gatewayUrl: testGatewayUrl,
      });

      expect(result.totalPaid).toBe('10');
      expect(result.platformFee).toBe('0.25');
      expect(result.sellerReceived).toBe('9.75');
    });
  });

  // ============================================================================
  // Stats
  // ============================================================================

  describe('getCreatorStats', () => {
    it('should return zero stats for creator with no listings', async () => {
      listingRepo.find.mockResolvedValue([]);

      const stats = await service.getCreatorStats('eth|nobody');

      expect(stats.totalListings).toBe(0);
      expect(stats.totalSold).toBe(0);
      expect(stats.totalRevenue).toBe('0');
    });
  });
});
