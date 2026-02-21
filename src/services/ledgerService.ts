import { JournalEntry, AccountLedger, LedgerLine } from '../types';

import { normalizeSpecificAccounts, areStringsSimilar } from '../utils/stringSimilarity';
import { guardEntry } from './watchdog/glosaEngine';
import { normalizeText, tokenize } from './watchdog/normalizationEngine';
import { combinedSimilarity } from './watchdog/duplicateEngine';

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
    // ═══ WATCHDOG: Defense-in-depth guard ═══
    // If a glosa entry escaped the primary filter (parser), catch it here.
    if (!guardEntry(entry)) return; // Skip silently — warning already logged by guardEntry

    // Normalize code to uppercase to ensure "Caja" == "CAJA" == "caja" (Ticket: Case Insensitive Grouping)
    // AND Handle specific aliases like "CAJA Y BANCOS" => "BANCOS"
    let rawNormalized = normalizeSpecificAccounts(entry.accountCode);

    // WATCHDOG ENHANCEMENT: Use deep normalization to kill exact hidden duplicates
    const canonicalKey = normalizeText(rawNormalized);
    const entryTokens = tokenize(canonicalKey);
    let targetKey = canonicalKey;

    // 1. Try Exact Match
    if (!ledgerMap[targetKey]) {
      // 2. Try Fuzzy Match (Ticket: Handle Typos like "Interezez" vs "Intereses")
      // Check if any existing key is similar enough (>85% match or limited edits)
      const similarKey = Object.keys(ledgerMap).find(k => {
        // If strictly similar by old rules (handles critical conflicts)
        if (areStringsSimilar(k, canonicalKey)) return true;

        // Watchdog enhanced semantic similarity
        const existingTokens = tokenize(k);
        return combinedSimilarity(k, canonicalKey, existingTokens, entryTokens) > 0.85;
      });

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
