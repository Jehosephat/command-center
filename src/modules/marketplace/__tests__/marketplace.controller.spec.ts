import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceService } from '../marketplace.service';

describe('MarketplaceController', () => {
  let controller: MarketplaceController;
  let service: jest.Mocked<MarketplaceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [
        {
          provide: MarketplaceService,
          useValue: {
            getListings: jest.fn().mockResolvedValue({ results: [], total: 0 }),
            getListingById: jest.fn().mockResolvedValue({ id: '1', collection: 'Test' }),
            getListingsByCreator: jest.fn().mockResolvedValue([]),
            createListing: jest.fn().mockResolvedValue({ id: '1', collection: 'NFT' }),
            updateListing: jest.fn().mockResolvedValue({ id: '1', isActive: false }),
            executePurchase: jest.fn().mockResolvedValue({ id: 'p1', status: 'minted' }),
            getPurchasesByBuyer: jest.fn().mockResolvedValue([]),
            getListingStats: jest.fn().mockResolvedValue({ totalSold: 0 }),
            getCreatorStats: jest.fn().mockResolvedValue({ totalListings: 0 }),
          },
        },
      ],
    }).compile();

    controller = module.get<MarketplaceController>(MarketplaceController);
    service = module.get(MarketplaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getListings', () => {
    it('should call service.getListings with query params', async () => {
      await controller.getListings({ collection: 'Test', limit: 10 });
      expect(service.getListings).toHaveBeenCalledWith({ collection: 'Test', limit: 10 });
    });
  });

  describe('getListingById', () => {
    it('should call service.getListingById', async () => {
      await controller.getListingById('123');
      expect(service.getListingById).toHaveBeenCalledWith('123');
    });
  });

  describe('createListing', () => {
    it('should call service.createListing', async () => {
      const dto = {
        creatorAddress: 'eth|creator',
        collection: 'NFT',
        category: 'Item',
        type: 'Sword',
        additionalKey: 'none',
        priceAmount: '10',
        priceTokenCollection: 'GALA',
        priceTokenCategory: 'Unit',
        priceTokenType: 'none',
        priceTokenAdditionalKey: 'none',
      };
      await controller.createListing(dto);
      expect(service.createListing).toHaveBeenCalledWith(dto);
    });
  });

  describe('executePurchase', () => {
    it('should call service.executePurchase', async () => {
      const dto = {
        listingId: '1',
        quantity: 1,
        buyerAddress: 'eth|buyer',
        signedTransferDto: { to: 'eth|fulfiller', quantity: '10' },
        gatewayUrl: 'https://gateway-testnet.example.com',
      };
      await controller.executePurchase(dto);
      expect(service.executePurchase).toHaveBeenCalledWith(dto);
    });
  });

  describe('stats', () => {
    it('should call service.getListingStats', async () => {
      await controller.getListingStats('listing-1');
      expect(service.getListingStats).toHaveBeenCalledWith('listing-1');
    });

    it('should call service.getCreatorStats', async () => {
      await controller.getCreatorStats('eth|creator');
      expect(service.getCreatorStats).toHaveBeenCalledWith('eth|creator');
    });
  });
});
