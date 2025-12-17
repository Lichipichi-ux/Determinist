export interface JournalEntry {
  id: string; // Internal UUID for React keys
  date: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  entryId: string; // "ID de asiento" or "Partida X"
  originalLine: number; // For auditability
}

export interface LedgerLine extends JournalEntry {
  runningBalance: number;
}

export interface AccountLedger {
  accountCode: string;
  accountName: string;
  entries: LedgerLine[];
  finalBalance: number;
}

export interface ProcessingError {
  line: number;
  message: string;
  type: 'STRUCTURAL' | 'DATA_TYPE' | 'FORMAT';
}

export type ParseResult = 
  | { success: true; data: JournalEntry[] }
  | { success: false; errors: ProcessingError[] };
