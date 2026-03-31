import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsUrl, Matches } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  creatorAddress: string;

  // Token class key (the NFT to sell)
  @IsString()
  @IsNotEmpty()
  collection: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  additionalKey: string;

  // Price
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'priceAmount must be a numeric string' })
  priceAmount: string;

  // Payment token key
  @IsString()
  @IsNotEmpty()
  priceTokenCollection: string;

  @IsString()
  @IsNotEmpty()
  priceTokenCategory: string;

  @IsString()
  @IsNotEmpty()
  priceTokenType: string;

  @IsString()
  @IsNotEmpty()
  priceTokenAdditionalKey: string;

  // Limits
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxPerWallet?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  totalSupply?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  platformFeePercent?: number;
}
