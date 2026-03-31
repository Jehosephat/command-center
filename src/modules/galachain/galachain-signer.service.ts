import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ec as EC } from 'elliptic';
import { keccak256 } from 'js-sha3';
import stringify from 'json-stringify-deterministic';
import { randomUUID } from 'crypto';
import { Buffer } from 'buffer';
import BN from 'bn.js';

const ecSecp256k1 = new EC('secp256k1');

@Injectable()
export class GalaChainSignerService implements OnModuleInit {
  private readonly logger = new Logger(GalaChainSignerService.name);
  private ecKey: EC.KeyPair;
  private _fulfillerAddress: string;
  private _publicKey: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const privateKey = this.configService.get<string>('fulfiller.privateKey', '');
    this._fulfillerAddress = this.configService.get<string>('fulfiller.address', '');

    if (privateKey) {
      this.ecKey = ecSecp256k1.keyFromPrivate(privateKey, 'hex');
      // Derive the uncompressed public key (hex, no 04 prefix needed — GalaChain expects the full key)
      this._publicKey = this.ecKey.getPublic(false, 'hex');
      this.logger.log(`Fulfiller wallet configured: ${this._fulfillerAddress}`);
    } else {
      this.logger.warn('No FULFILLER_PRIVATE_KEY configured — marketplace purchases will fail');
    }
  }

  get fulfillerAddress(): string {
    return this._fulfillerAddress;
  }

  get isConfigured(): boolean {
    return !!this.ecKey && !!this._fulfillerAddress;
  }

  /**
   * Generate a unique key for GalaChain DTOs (prevents replay attacks)
   */
  generateUniqueKey(): string {
    return Buffer.from(randomUUID().replace(/-/g, ''), 'hex').toString('base64');
  }

  /**
   * Sign a DTO with the fulfiller private key.
   * Follows the gala-faucet pattern: keccak256(deterministic JSON) → ECDSA → base64 DER
   */
  signDto<T extends Record<string, unknown>>(dto: T): T & { signature: string } {
    if (!this.ecKey) {
      throw new Error('Fulfiller wallet not configured');
    }

    // Remove existing signature if present
    const toSign = { ...dto };
    delete toSign.signature;

    // Deterministic JSON → keccak256 hash
    const stringToSign = stringify(toSign);
    const hash = Buffer.from(keccak256.digest(Buffer.from(stringToSign)));

    // ECDSA sign
    const signature = ecSecp256k1.sign(hash, this.ecKey);

    // Normalize s (BIP-62: low-S)
    if (signature.s.cmp(ecSecp256k1.curve.n.shrn(1)) > 0) {
      const curveN = ecSecp256k1.curve.n as BN;
      signature.s = curveN.sub(signature.s);
      if (signature.recoveryParam !== null && signature.recoveryParam !== undefined) {
        signature.recoveryParam = 1 - signature.recoveryParam;
      }
    }

    // Encode as base64 DER
    const signatureString = Buffer.from(signature.toDER()).toString('base64');

    return {
      ...toSign,
      signerPublicKey: this._publicKey,
      signature: signatureString,
    } as T & { signerPublicKey: string; signature: string };
  }

  /**
   * Build and sign a MintTokenWithAllowance DTO
   */
  buildSignedMintDto(
    tokenClass: { collection: string; category: string; type: string; additionalKey: string },
    owner: string,
    quantity: string,
  ): Record<string, unknown> {
    const dto = {
      tokenClass,
      tokenInstance: '0',
      owner,
      quantity,
      uniqueKey: this.generateUniqueKey(),
    };
    return this.signDto(dto);
  }

  /**
   * Build and sign a TransferToken DTO
   */
  buildSignedTransferDto(
    from: string,
    to: string,
    tokenInstance: {
      collection: string;
      category: string;
      type: string;
      additionalKey: string;
      instance: string;
    },
    quantity: string,
  ): Record<string, unknown> {
    const dto = {
      from,
      to,
      tokenInstance,
      quantity,
      uniqueKey: this.generateUniqueKey(),
    };
    return this.signDto(dto);
  }
}
