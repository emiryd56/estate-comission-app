import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TransactionStage } from '../enums/transaction-stage.enum';

@Schema({ _id: false, versionKey: false })
export class StageHistoryEntry {
  @Prop({
    type: String,
    enum: Object.values(TransactionStage),
    required: true,
  })
  stage!: TransactionStage;

  @Prop({ type: Date, required: true, default: Date.now })
  changedAt!: Date;
}

export const StageHistoryEntrySchema =
  SchemaFactory.createForClass(StageHistoryEntry);
