import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import BigNumber from 'bignumber.js';
import { Listing } from './entities/listing.entity';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { PurchaseDto } from './dto/purchase.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { GalaChainGatewayService } from '../galachain/galachain-gateway.service';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);
  private readonly defaultFeePercent: number;

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly gateway: GalaChainGatewayService,
    private readonly configService: ConfigService,
  ) {
    this.defaultFeePercent = this.configService.get<number>('platform.feePercent', 2.5);
  }

  // ============================================================================
  // Listings
  // ============================================================================

  async createListing(dto: CreateListingDto): Promise<Listing> {
    const listing = this.listingRepo.create({
      ...dto,
      platformFeePercent: dto.platformFeePercent ?? this.defaultFeePercent,
    });
    return this.listingRepo.save(listing);
  }

  async getListings(query: ListingQueryDto): Promise<{ results: Listing[]; total: number }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    const qb = this.listingRepo.createQueryBuilder('listing')
      .where('listing.isActive = :active', { active: true });

    if (query.collection) {
      qb.andWhere('listing.collection = :collection', { collection: query.collection });
    }

    if (query.search) {
      qb.andWhere('(listing.name LIKE :search OR listing.collection LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('listing.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [results, total] = await qb.getManyAndCount();
    return { results, total };
  }

  async getListingById(id: string): Promise<Listing> {
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Listing ${id} not found`);
    }
    return listing;
  }

  async getListingsByCreator(address: string): Promise<Listing[]> {
    return this.listingRepo.find({
      where: { creatorAddress: address },
      order: { createdAt: 'DESC' },
    });
  }

  async updateListing(id: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.getListingById(id);

    if (listing.creatorAddress.toLowerCase() !== dto.creatorAddress.toLowerCase()) {
      throw new ForbiddenException('Only the listing creator can update it');
    }

    if (dto.priceAmount !== undefined) listing.priceAmount = dto.priceAmount;
    if (dto.isActive !== undefined) listing.isActive = dto.isActive;
    if (dto.maxPerWallet !== undefined) listing.maxPerWallet = dto.maxPerWallet;
    if (dto.totalSupply !== undefined) listing.totalSupply = dto.totalSupply;

    return this.listingRepo.save(listing);
  }

  // ============================================================================
  // Purchases
  // ============================================================================

  async executePurchase(dto: PurchaseDto): Promise<Purchase> {
    if (!this.gateway.isConfigured) {
      throw new BadRequestException('Marketplace fulfiller is not configured');
    }

    // 1. Validate listing
    const listing = await this.getListingById(dto.listingId);

    if (!listing.isActive) {
      throw new BadRequestException('This listing is no longer active');
    }

    // Check supply
    if (listing.totalSupply !== null) {
      const remaining = listing.totalSupply - listing.totalSold;
      if (dto.quantity > remaining) {
        throw new BadRequestException(`Only ${remaining} NFT(s) remaining`);
      }
    }

    // Check per-wallet limit
    if (listing.maxPerWallet !== null) {
      const existingPurchases = await this.purchaseRepo
        .createQueryBuilder('p')
        .select('SUM(p.quantity)', 'total')
        .where('p.listingId = :listingId', { listingId: listing.id })
        .andWhere('LOWER(p.buyerAddress) = LOWER(:buyer)', { buyer: dto.buyerAddress })
        .andWhere('p.status IN (:...statuses)', { statuses: [PurchaseStatus.PAYMENT_VERIFIED, PurchaseStatus.MINTED] })
        .getRawOne();

      const alreadyPurchased = parseInt(existingPurchases?.total || '0', 10);
      if (alreadyPurchased + dto.quantity > listing.maxPerWallet) {
        throw new BadRequestException(
          `Purchase would exceed per-wallet limit of ${listing.maxPerWallet} (you've already purchased ${alreadyPurchased})`,
        );
      }
    }

    // 2. Calculate amounts
    const pricePerUnit = new BigNumber(listing.priceAmount);
    const totalCost = pricePerUnit.times(dto.quantity);
    const platformFee = totalCost.times(listing.platformFeePercent).div(100);
    const sellerReceived = totalCost.minus(platformFee);

    // 3. Validate the signed transfer DTO
    const transferDto = dto.signedTransferDto;
    const expectedTo = this.configService.get<string>('fulfiller.address', '');

    if (String(transferDto.to).toLowerCase() !== expectedTo.toLowerCase()) {
      throw new BadRequestException(`Transfer recipient must be ${expectedTo}`);
    }

    // Validate the transfer amount matches
    const transferQuantity = new BigNumber(String(transferDto.quantity || '0'));
    if (!transferQuantity.isEqualTo(totalCost)) {
      throw new BadRequestException(
        `Transfer amount ${transferQuantity} does not match expected ${totalCost}`,
      );
    }

    // 4. Create purchase record
    const purchase = this.purchaseRepo.create({
      listingId: listing.id,
      buyerAddress: dto.buyerAddress,
      quantity: dto.quantity,
      totalPaid: totalCost.toString(),
      platformFee: platformFee.toString(),
      sellerReceived: sellerReceived.toString(),
      paymentTxSignature: JSON.stringify(transferDto),
      status: PurchaseStatus.PENDING,
    });
    await this.purchaseRepo.save(purchase);

    try {
      // 6. Submit the buyer's signed transfer to GalaChain
      this.logger.log(`Submitting payment for purchase ${purchase.id}`);
      await this.gateway.submitSignedDto('TransferToken', transferDto, dto.gatewayUrl);

      purchase.status = PurchaseStatus.PAYMENT_VERIFIED;
      await this.purchaseRepo.save(purchase);

      // 6. Transfer seller's portion from fulfiller to creator
      if (sellerReceived.isGreaterThan(0)) {
        this.logger.log(`Transferring ${sellerReceived} to seller ${listing.creatorAddress}`);
        await this.gateway.transferFromFulfiller(
          listing.creatorAddress,
          {
            collection: listing.priceTokenCollection,
            category: listing.priceTokenCategory,
            type: listing.priceTokenType,
            additionalKey: listing.priceTokenAdditionalKey,
            instance: '0',
          },
          sellerReceived.toString(),
          dto.gatewayUrl,
        );
      }

      // 7. Mint NFT(s) to buyer
      this.logger.log(`Minting ${dto.quantity} NFT(s) to ${dto.buyerAddress}`);
      const mintResult = await this.gateway.mintToOwner(
        {
          collection: listing.collection,
          category: listing.category,
          type: listing.type,
          additionalKey: listing.additionalKey,
        },
        dto.buyerAddress,
        String(dto.quantity),
        dto.gatewayUrl,
      );

      // 8. Record success
      purchase.mintedInstances = JSON.stringify(mintResult);
      purchase.status = PurchaseStatus.MINTED;
      await this.purchaseRepo.save(purchase);

      // Increment sold count
      listing.totalSold += dto.quantity;
      await this.listingRepo.save(listing);

      this.logger.log(`Purchase ${purchase.id} completed successfully`);
      return purchase;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Purchase ${purchase.id} failed: ${errorMsg}`);

      purchase.errorMessage = errorMsg;
      if (purchase.status === PurchaseStatus.PENDING) {
        purchase.status = PurchaseStatus.FAILED;
      }
      // If payment_verified but mint failed, keep that status for retry
      await this.purchaseRepo.save(purchase);

      throw new BadRequestException(`Purchase failed: ${errorMsg}`);
    }
  }

  // ============================================================================
  // Purchase History & Stats
  // ============================================================================

  async getPurchasesByBuyer(address: string): Promise<Purchase[]> {
    return this.purchaseRepo.find({
      where: { buyerAddress: address },
      order: { createdAt: 'DESC' },
      relations: ['listing'],
    });
  }

  async getListingStats(listingId: string): Promise<{
    totalSold: number;
    totalRevenue: string;
    totalFees: string;
    uniqueBuyers: number;
  }> {
    const listing = await this.getListingById(listingId);

    const stats = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('SUM(p.quantity)', 'totalSold')
      .addSelect('SUM(CAST(p.totalPaid AS REAL))', 'totalRevenue')
      .addSelect('SUM(CAST(p.platformFee AS REAL))', 'totalFees')
      .addSelect('COUNT(DISTINCT LOWER(p.buyerAddress))', 'uniqueBuyers')
      .where('p.listingId = :listingId', { listingId })
      .andWhere('p.status = :status', { status: PurchaseStatus.MINTED })
      .getRawOne();

    return {
      totalSold: parseInt(stats?.totalSold || '0', 10),
      totalRevenue: String(stats?.totalRevenue || '0'),
      totalFees: String(stats?.totalFees || '0'),
      uniqueBuyers: parseInt(stats?.uniqueBuyers || '0', 10),
    };
  }

  async getCreatorStats(address: string): Promise<{
    totalListings: number;
    activeListings: number;
    totalSold: number;
    totalRevenue: string;
    uniqueBuyers: number;
  }> {
    const listings = await this.listingRepo.find({
      where: { creatorAddress: address },
    });

    const listingIds = listings.map((l) => l.id);

    if (listingIds.length === 0) {
      return {
        totalListings: 0,
        activeListings: 0,
        totalSold: 0,
        totalRevenue: '0',
        uniqueBuyers: 0,
      };
    }

    const stats = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('SUM(p.quantity)', 'totalSold')
      .addSelect('SUM(CAST(p.sellerReceived AS REAL))', 'totalRevenue')
      .addSelect('COUNT(DISTINCT LOWER(p.buyerAddress))', 'uniqueBuyers')
      .where('p.listingId IN (:...ids)', { ids: listingIds })
      .andWhere('p.status = :status', { status: PurchaseStatus.MINTED })
      .getRawOne();

    return {
      totalListings: listings.length,
      activeListings: listings.filter((l) => l.isActive).length,
      totalSold: parseInt(stats?.totalSold || '0', 10),
      totalRevenue: String(stats?.totalRevenue || '0'),
      uniqueBuyers: parseInt(stats?.uniqueBuyers || '0', 10),
    };
  }
}
