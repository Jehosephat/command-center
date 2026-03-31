import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { PurchaseDto } from './dto/purchase.dto';
import { ListingQueryDto } from './dto/listing-query.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ============================================================================
  // Listings
  // ============================================================================

  @Get('listings')
  getListings(@Query() query: ListingQueryDto) {
    return this.marketplaceService.getListings(query);
  }

  @Get('listings/creator/:address')
  getListingsByCreator(@Param('address') address: string) {
    return this.marketplaceService.getListingsByCreator(address);
  }

  @Get('listings/:id')
  getListingById(@Param('id') id: string) {
    return this.marketplaceService.getListingById(id);
  }

  @Post('listings')
  createListing(@Body() dto: CreateListingDto) {
    return this.marketplaceService.createListing(dto);
  }

  @Patch('listings/:id')
  updateListing(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.marketplaceService.updateListing(id, dto);
  }

  // ============================================================================
  // Purchases
  // ============================================================================

  @Post('purchase')
  executePurchase(@Body() dto: PurchaseDto) {
    return this.marketplaceService.executePurchase(dto);
  }

  @Get('purchases/buyer/:address')
  getPurchasesByBuyer(@Param('address') address: string) {
    return this.marketplaceService.getPurchasesByBuyer(address);
  }

  // ============================================================================
  // Stats
  // ============================================================================

  @Get('stats/listing/:id')
  getListingStats(@Param('id') id: string) {
    return this.marketplaceService.getListingStats(id);
  }

  @Get('stats/creator/:address')
  getCreatorStats(@Param('address') address: string) {
    return this.marketplaceService.getCreatorStats(address);
  }
}
