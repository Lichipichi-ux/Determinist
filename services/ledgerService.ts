import { JournalEntry, AccountLedger, LedgerLine } from '../types';

/**
 * Core Logic: Group by Account and Calculate Running Balance
 * Algorithm per Ticket 3.3: saldo += debe; saldo -= haber;
 */
export const generateLedger = (entries: JournalEntry[]): Record<string, AccountLedger> => {
  const ledgerMap: Record<string, AccountLedger> = {};

  // Sort entries to ensure chronological order if not already (Ticket 3.2)
  // Although Ticket 3.2 says "El orden original se conserva" within ID grouping,
  // Ledger generally requires chronological. We will respect file order as primary,
  // assuming the file is a chronologically ordered journal.
  // If strict date sorting is needed:
  // entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  entries.forEach(entry => {
    const code = entry.accountCode;

    if (!ledgerMap[code]) {
      ledgerMap[code] = {
        accountCode: code,
        accountName: entry.accountName,
        entries: [],
        finalBalance: 0
      };
    }

    // Get previous balance
    const currentLedger = ledgerMap[code];
    const previousBalance = currentLedger.entries.length > 0 
      ? currentLedger.entries[currentLedger.entries.length - 1].runningBalance 
      : 0;

    // Calculate new balance (Ticket 3.3)
    const newBalance = previousBalance + entry.debit - entry.credit;

    // Create Ledger Line
    const ledgerLine: LedgerLine = {
      ...entry,
      runningBalance: newBalance
    };

    currentLedger.entries.push(ledgerLine);
    currentLedger.finalBalance = newBalance;
  });

  return ledgerMap;
};
