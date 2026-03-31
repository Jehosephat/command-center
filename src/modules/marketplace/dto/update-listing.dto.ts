import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, Matches } from 'class-validator';

export class UpdateListingDto {
  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/, { message: 'priceAmount must be a numeric string' })
  priceAmount?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxPerWallet?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  totalSupply?: number;

  /** Creator address for ownership verification */
  @IsString()
  creatorAddress: string;
}
