import { IsString, IsNotEmpty, IsNumber, Min, IsObject } from 'class-validator';

export class PurchaseDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  buyerAddress: string;

  /**
   * The buyer's pre-signed TransferToken DTO.
   * Backend validates fields match expected values, then submits to GalaChain.
   */
  @IsObject()
  @IsNotEmpty()
  signedTransferDto: Record<string, unknown>;

  /** Gateway URL from the frontend (ensures backend uses the same network) */
  @IsString()
  @IsNotEmpty()
  gatewayUrl: string;
}
