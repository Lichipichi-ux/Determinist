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
  isHidden?: boolean;
}

export interface AccountLedger {
  accountCode: string;
  accountName: string;
  entries: LedgerLine[];
  finalBalance: number;
  firstLine: number; // Order of appearance
}

export interface ProcessingError {
  line: number;
  message: string;
  type: 'STRUCTURAL' | 'DATA_TYPE' | 'FORMAT';
}

export type ParseResult =
  | { success: true; data: JournalEntry[] }
  | { success: false; errors: ProcessingError[] };

// --- Chart Selector / Structure Compiler Types ---

export interface ChartNode {
  id: string;
  name: string;
  code?: string;
  isMandatory?: boolean;
  children?: ChartNode[];
  level: 'GROUP' | 'SUBGROUP' | 'ACCOUNT';
}

export interface ChartSelectionState {
  // Source of truth: BookID -> { selectedIds, selectionOrder }
  [bookId: string]: {
    selectedIds: Set<string>;
    selectionOrder: string[];
  };
}

export interface FinancialStructure {
  id: string;
  title: string;
  rootNodes: ChartNode[];
  obligatoryRules: string[]; // Logic identifiers for forced rows
}

// --- Watchdog Module Types ---

export interface WatchdogAlert {
  id: string;
  timestamp: string;
  entryId: string;
  accountName: string;
  description: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
}