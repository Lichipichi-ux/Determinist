import { JournalEntry, AccountLedger, LedgerLine } from '../types';

import { normalizeSpecificAccounts, areStringsSimilar } from '../utils/stringSimilarity';

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
    // Normalize code to uppercase to ensure "Caja" == "CAJA" == "caja" (Ticket: Case Insensitive Grouping)
    // AND Handle specific aliases like "CAJA Y BANCOS" => "BANCOS"
    const normalizedCode = normalizeSpecificAccounts(entry.accountCode);
    let targetKey = normalizedCode;

    // 1. Try Exact Match
    if (!ledgerMap[targetKey]) {
      // 2. Try Fuzzy Match (Ticket: Handle Typos like "Interezez" vs "Intereses")
      // Check if any existing key is similar enough (>85% match or limited edits)
      const similarKey = Object.keys(ledgerMap).find(k => areStringsSimilar(k, normalizedCode));

      if (similarKey) {
        // Found a match! Use the existing key so they group together.
        targetKey = similarKey;
      }
    }

    if (!ledgerMap[targetKey]) {
      ledgerMap[targetKey] = {
        accountCode: targetKey,
        accountName: entry.accountName, // Keep original name of first occurrence
        entries: [],
        finalBalance: 0,
        firstLine: entry.originalLine
      };
    }

    // Get previous balance
    const currentLedger = ledgerMap[targetKey];
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
