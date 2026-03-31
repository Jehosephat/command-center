import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Listing } from './listing.entity';

export enum PurchaseStatus {
  PENDING = 'pending',
  PAYMENT_VERIFIED = 'payment_verified',
  MINTED = 'minted',
  FAILED = 'failed',
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  listingId: string;

  @Column()
  buyerAddress: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column()
  totalPaid: string;

  @Column()
  platformFee: string;

  @Column()
  sellerReceived: string;

  @Column({ type: 'text' })
  paymentTxSignature: string;

  @Column({ type: 'text', nullable: true })
  mintedInstances: string | null;

  @Column({ type: 'varchar', default: PurchaseStatus.PENDING })
  status: PurchaseStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Listing, (listing) => listing.purchases)
  @JoinColumn({ name: 'listingId' })
  listing: Listing;
}
