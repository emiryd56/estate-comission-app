import { TransactionDocument } from '../schemas/transaction.schema';
import { TransactionStage } from '../enums/transaction-stage.enum';

interface PopulatedAgent {
  _id: unknown;
  name?: string;
  email?: string;
}

const STAGE_LABELS: Readonly<Record<TransactionStage, string>> = {
  [TransactionStage.AGREEMENT]: 'Anlaşma',
  [TransactionStage.EARNEST_MONEY]: 'Kaparo',
  [TransactionStage.TITLE_DEED]: 'Tapu',
  [TransactionStage.COMPLETED]: 'Tamamlandı',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderAgent(raw: unknown, fallback: string): string {
  const agent = raw as PopulatedAgent | null | undefined;
  if (!agent || typeof agent !== 'object') {
    return fallback;
  }
  if (agent.name) {
    return agent.email ? `${agent.name} <${agent.email}>` : agent.name;
  }
  return fallback;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function divider(char: string, width = 64): string {
  return char.repeat(width);
}

export function buildTransactionExport(
  transaction: TransactionDocument,
): string {
  const id = String(transaction._id);
  const createdAt = (transaction as unknown as { createdAt?: Date }).createdAt;
  const updatedAt = (transaction as unknown as { updatedAt?: Date }).updatedAt;

  const lines: string[] = [];
  lines.push(divider('='));
  lines.push('  EMLAK KOMİSYON - İŞLEM RAPORU');
  lines.push(divider('='));
  lines.push('');
  lines.push(`İşlem No   : ${id}`);
  lines.push(`Başlık     : ${transaction.title}`);
  lines.push(`Durum      : ${STAGE_LABELS[transaction.stage]}`);
  lines.push(
    `Oluşturma  : ${createdAt ? formatDate(createdAt) : '-'}`,
  );
  lines.push(
    `Güncelleme : ${updatedAt ? formatDate(updatedAt) : '-'}`,
  );
  lines.push('');

  lines.push(divider('-'));
  lines.push('  DANIŞMANLAR');
  lines.push(divider('-'));
  lines.push(
    `İlan Danışmanı  : ${renderAgent(transaction.listingAgent, '—')}`,
  );
  lines.push(
    `Satış Danışmanı : ${renderAgent(transaction.sellingAgent, '—')}`,
  );
  lines.push('');

  lines.push(divider('-'));
  lines.push('  AŞAMA GEÇMİŞİ');
  lines.push(divider('-'));
  if (transaction.stageHistory && transaction.stageHistory.length > 0) {
    lines.push(`${pad('#', 4)}${pad('Aşama', 20)}Tarih`);
    lines.push(divider('-'));
    transaction.stageHistory.forEach((entry, index) => {
      const order = String(index + 1).padEnd(4, ' ');
      const label = pad(STAGE_LABELS[entry.stage], 20);
      const date = formatDate(new Date(entry.changedAt));
      lines.push(`${order}${label}${date}`);
    });
  } else {
    lines.push('(Kayıt yok)');
  }
  lines.push('');

  lines.push(divider('-'));
  lines.push('  FİNANSAL DÖKÜM');
  lines.push(divider('-'));
  lines.push(`Toplam Komisyon : ${formatCurrency(transaction.totalFee)}`);
  if (
    transaction.stage === TransactionStage.COMPLETED &&
    transaction.financialBreakdown
  ) {
    const fb = transaction.financialBreakdown;
    lines.push(`Şirket Payı       : ${formatCurrency(fb.companyCut ?? 0)}`);
    lines.push(
      `İlan Danışmanı P. : ${formatCurrency(fb.listingAgentCut ?? 0)}`,
    );
    lines.push(
      `Satış Danışmanı P.: ${formatCurrency(fb.sellingAgentCut ?? 0)}`,
    );
  } else {
    lines.push('(İşlem tamamlanmadığı için hak ediş hesaplanmamıştır.)');
  }
  lines.push('');
  lines.push(divider('='));
  lines.push(`  Rapor oluşturulma zamanı: ${formatDate(new Date())}`);
  lines.push(divider('='));
  lines.push('');

  return lines.join('\n');
}

export function buildExportFilename(transaction: TransactionDocument): string {
  const id = String(transaction._id);
  const slug = transaction.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'islem';
  return `${slug}-${id}.txt`;
}
