import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { TransactionStage } from '../enums/transaction-stage.enum';
import {
  FinancialBreakdown,
  FinancialBreakdownSchema,
} from './financial-breakdown.schema';
import {
  StageHistoryEntry,
  StageHistoryEntrySchema,
} from './stage-history-entry.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true, versionKey: false })
export class Transaction {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({
    type: String,
    enum: Object.values(TransactionStage),
    default: TransactionStage.AGREEMENT,
    required: true,
    index: true,
  })
  stage!: TransactionStage;

  @Prop({ type: Number, required: true, min: 0 })
  totalFee!: number;

  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  listingAgent!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  sellingAgent!: Types.ObjectId;

  @Prop({ type: FinancialBreakdownSchema, required: false })
  financialBreakdown?: FinancialBreakdown;

  @Prop({ type: [StageHistoryEntrySchema], default: [] })
  stageHistory!: StageHistoryEntry[];
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Listings and dashboards always sort by createdAt desc; compounding each
// high-selectivity field with createdAt lets MongoDB serve the RBAC-filtered,
// stage-filtered, and agent-filtered dashboards using a single index scan
// without an in-memory sort.
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ stage: 1, createdAt: -1 });
TransactionSchema.index({ listingAgent: 1, createdAt: -1 });
TransactionSchema.index({ sellingAgent: 1, createdAt: -1 });
