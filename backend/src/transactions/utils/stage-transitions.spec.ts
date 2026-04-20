import { TransactionStage } from '../enums/transaction-stage.enum';
import { canTransition } from './stage-transitions';

describe('canTransition', () => {
  describe('valid forward transitions', () => {
    it.each<[TransactionStage, TransactionStage]>([
      [TransactionStage.AGREEMENT, TransactionStage.EARNEST_MONEY],
      [TransactionStage.EARNEST_MONEY, TransactionStage.TITLE_DEED],
      [TransactionStage.TITLE_DEED, TransactionStage.COMPLETED],
    ])('allows %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });
  });

  describe('skipping stages is forbidden', () => {
    it.each<[TransactionStage, TransactionStage]>([
      [TransactionStage.AGREEMENT, TransactionStage.TITLE_DEED],
      [TransactionStage.AGREEMENT, TransactionStage.COMPLETED],
      [TransactionStage.EARNEST_MONEY, TransactionStage.COMPLETED],
    ])('rejects %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('backward transitions are forbidden', () => {
    it.each<[TransactionStage, TransactionStage]>([
      [TransactionStage.EARNEST_MONEY, TransactionStage.AGREEMENT],
      [TransactionStage.TITLE_DEED, TransactionStage.EARNEST_MONEY],
      [TransactionStage.TITLE_DEED, TransactionStage.AGREEMENT],
      [TransactionStage.COMPLETED, TransactionStage.TITLE_DEED],
      [TransactionStage.COMPLETED, TransactionStage.EARNEST_MONEY],
      [TransactionStage.COMPLETED, TransactionStage.AGREEMENT],
    ])('rejects %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('self transitions are forbidden', () => {
    it.each<TransactionStage>([
      TransactionStage.AGREEMENT,
      TransactionStage.EARNEST_MONEY,
      TransactionStage.TITLE_DEED,
      TransactionStage.COMPLETED,
    ])('rejects %s -> %s', (stage) => {
      expect(canTransition(stage, stage)).toBe(false);
    });
  });

  describe('COMPLETED is a terminal state', () => {
    it('cannot transition to any other stage', () => {
      const otherStages: TransactionStage[] = [
        TransactionStage.AGREEMENT,
        TransactionStage.EARNEST_MONEY,
        TransactionStage.TITLE_DEED,
        TransactionStage.COMPLETED,
      ];

      for (const target of otherStages) {
        expect(canTransition(TransactionStage.COMPLETED, target)).toBe(false);
      }
    });
  });
});
