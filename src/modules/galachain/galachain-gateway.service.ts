import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createValidSubmitDTO,
  MintTokenDto,
  TransferTokenDto,
} from '@gala-chain/api';
import BigNumber from 'bignumber.js';

interface GalaChainResponse<T = unknown> {
  Status: number;
  Data?: T;
  Message?: string;
  Error?: string;
  ErrorCode?: number;
}

@Injectable()
export class GalaChainGatewayService {
  private readonly logger = new Logger(GalaChainGatewayService.name);
  private readonly gatewayUrl: string;
  private readonly fulfillerPrivateKey: string;
  private readonly fulfillerAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.gatewayUrl = this.configService.get<string>('galachain.gatewayUrl', '');
    this.fulfillerPrivateKey = this.configService.get<string>('fulfiller.privateKey', '');
    this.fulfillerAddress = this.configService.get<string>('fulfiller.address', '');
  }

  get isConfigured(): boolean {
    return !!this.fulfillerPrivateKey && !!this.fulfillerAddress;
  }

  /**
   * Submit a pre-signed DTO to the GalaChain gateway
   */
  async submitSignedDto<T = unknown>(method: string, signedDto: object, gatewayUrlOverride?: string): Promise<T> {
    const baseUrl = gatewayUrlOverride || this.gatewayUrl;
    const url = `${baseUrl}/${method}`;
    this.logger.debug(`POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedDto),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GalaChain HTTP ${response.status}: ${body}`);
    }

    const result: GalaChainResponse<T> = await response.json();

    if (result.Status !== 1) {
      const msg = result.Message || result.Error || `GalaChain error (status ${result.Status})`;
      this.logger.error(`GalaChain ${method} failed: ${msg}`);
      throw new Error(msg);
    }

    return result.Data as T;
  }

  /**
   * Mint NFTs to an owner using the fulfiller's pre-granted allowance.
   * Uses MintToken (not MintTokenWithAllowance) since the creator already granted allowance.
   */
  async mintToOwner(
    tokenClass: { collection: string; category: string; type: string; additionalKey: string },
    owner: string,
    quantity: string,
    gatewayUrl?: string,
  ): Promise<unknown[]> {
    const signedDto = await createValidSubmitDTO(MintTokenDto, {
      tokenClass: tokenClass as any,
      owner: owner as any,
      quantity: new BigNumber(quantity),
    }).signed(this.fulfillerPrivateKey);

    return this.submitSignedDto<unknown[]>('MintToken', signedDto, gatewayUrl);
  }

  /**
   * Transfer tokens from the fulfiller wallet to a recipient.
   * Uses the SDK's TransferTokenDto with .signed() for proper signing.
   */
  async transferFromFulfiller(
    to: string,
    tokenInstance: {
      collection: string;
      category: string;
      type: string;
      additionalKey: string;
      instance: string;
    },
    quantity: string,
    gatewayUrl?: string,
  ): Promise<unknown> {
    const signedDto = await createValidSubmitDTO(TransferTokenDto, {
      from: this.fulfillerAddress as any,
      to: to as any,
      tokenInstance: {
        collection: tokenInstance.collection,
        category: tokenInstance.category,
        type: tokenInstance.type,
        additionalKey: tokenInstance.additionalKey,
        instance: new BigNumber(tokenInstance.instance),
      } as any,
      quantity: new BigNumber(quantity),
    }).signed(this.fulfillerPrivateKey);

    return this.submitSignedDto('TransferToken', signedDto, gatewayUrl);
  }
}
