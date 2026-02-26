import { JournalEntry, AccountLedger, LedgerLine, UserMode, WatchdogAlert } from '../types';

import { normalizeSpecificAccounts, areStringsSimilar } from '../utils/stringSimilarity';
import { guardEntry } from './watchdog/glosaEngine';
import { normalizeText, tokenize } from './watchdog/normalizationEngine';
import { combinedSimilarity } from './watchdog/duplicateEngine';
import { filterStructuralAccounts } from './watchdog/structuralFilter';

/**
 * Core Logic: Group by Account and Calculate Running Balance
 * Algorithm per Ticket 3.3: saldo += debe; saldo -= haber;
 */
export const generateLedger = (entries: JournalEntry[], mode: UserMode): { ledgerMap: Record<string, AccountLedger>, newAlerts: WatchdogAlert[] } => {
  const ledgerMap: Record<string, AccountLedger> = {};
  const newAlerts: WatchdogAlert[] = [];

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

    let targetKey = '';

    if (mode === 'Practica') {
      // Normalize code to uppercase to ensure "Caja" == "CAJA" == "caja" (Ticket: Case Insensitive Grouping)
      let rawNormalized = normalizeSpecificAccounts(entry.accountCode);

      // WATCHDOG ENHANCEMENT: Use deep normalization to kill exact hidden duplicates
      const canonicalKey = normalizeText(rawNormalized);
      const entryTokens = tokenize(canonicalKey);
      targetKey = canonicalKey;

      // 1. Try Exact Match
      if (!ledgerMap[targetKey]) {
        // 2. Try Fuzzy Match (Ticket: Handle Typos like "Interezez" vs "Intereses")
        const similarKey = Object.keys(ledgerMap).find(k => {
          if (areStringsSimilar(k, canonicalKey)) return true;
          const existingTokens = tokenize(k);
          return combinedSimilarity(k, canonicalKey, existingTokens, entryTokens) > 0.85;
        });

        if (similarKey) {
          targetKey = similarKey;
        }
      }
    } else if (mode === 'Bancaria') {
      // MODO CONTABILIDAD BANCARIA: Agrupar exclusivamente por Código de Cuenta.
      targetKey = entry.accountCode.trim().toUpperCase();

      // Check for inconsistent names for the same code
      if (ledgerMap[targetKey] && ledgerMap[targetKey].accountName !== entry.accountName) {
        // Registrar inconsistencia en Watchdog (no bloquear)
        newAlerts.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryId: entry.entryId,
          accountName: entry.accountName,
          description: `Discrepancia de Nombre en Código ${targetKey}`,
          severity: 'WARNING',
          message: `El código ${targetKey} tiene nombres inconsistentes: "${ledgerMap[targetKey].accountName}" vs "${entry.accountName}". Se agruparán bajo el primer nombre.`
        });
      }
    }

    if (!ledgerMap[targetKey]) {
      ledgerMap[targetKey] = {
        accountCode: targetKey,
        accountName: entry.accountName, // Keep original name of first occurrence
        entries: [],
        finalBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
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
    currentLedger.totalDebit += entry.debit;
    currentLedger.totalCredit += entry.credit;
  });

  // ═══ WATCHDOG: Structural Account Filter ═══
  const filteredMap = filterStructuralAccounts(ledgerMap);

  return { ledgerMap: filteredMap, newAlerts };
};
