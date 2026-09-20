import { saveAs } from 'file-saver';
import { AccountLedger } from '../types';
import { buildLedgerWorkbook, ExportOptions } from './ledgerWorkbook';
export { buildLedgerWorkbook } from './ledgerWorkbook';
export type { ExportOptions } from './ledgerWorkbook';

export const deriveExportFileName = (heading: string): string => {
  const name = heading.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 120);
  return `${name || 'Contabilidad'} - Libro Mayor y Balance.xlsx`;
};

export const exportFullLedger = async (
  ledgerData: Record<string, AccountLedger>, options: ExportOptions
): Promise<void> => {
  const workbook = buildLedgerWorkbook(ledgerData, options);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), deriveExportFileName(options.heading));
};
