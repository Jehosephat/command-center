import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Purchase } from './purchase.entity';

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  creatorAddress: string;

  // Token class key (the NFT being sold)
  @Column()
  collection: string;

  @Column()
  category: string;

  @Column()
  type: string;

  @Column()
  additionalKey: string;

  // Price in a GalaChain token
  @Column()
  priceAmount: string;

  @Column()
  priceTokenCollection: string;

  @Column()
  priceTokenCategory: string;

  @Column()
  priceTokenType: string;

  @Column()
  priceTokenAdditionalKey: string;

  // Limits
  @Column({ type: 'integer', nullable: true })
  maxPerWallet: number | null;

  @Column({ type: 'integer', nullable: true })
  totalSupply: number | null;

  @Column({ type: 'integer', default: 0 })
  totalSold: number;

  // Platform fee
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2.5 })
  platformFeePercent: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Purchase, (purchase) => purchase.listing)
  purchases: Purchase[];
}
