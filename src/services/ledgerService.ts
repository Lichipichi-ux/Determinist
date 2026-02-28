import { JournalEntry, AccountLedger, LedgerLine, UserMode, WatchdogAlert } from '../types';

import { normalizeSpecificAccounts, areStringsSimilar, hasKeywordConflict } from '../utils/stringSimilarity';
import { guardEntry } from './watchdog/glosaEngine';
import { normalizeText, tokenize } from './watchdog/normalizationEngine';
import { combinedSimilarity } from './watchdog/duplicateEngine';
import { filterStructuralAccounts } from './watchdog/structuralFilter';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * GUARDIAN BOX: Códigos que NUNCA deben agruparse juntos
 * Lista de pares de códigos problemáticos que se confunden frecuentemente
 * ═══════════════════════════════════════════════════════════════════════
 */
const CODE_GUARDIAN_MAP: Record<string, string[]> = {
  '101103.01': ['301101'],  // Estos códigos se confundieron, MANTENERLOS SEPARADOS
  '301101': ['101103.01'],  // Bidireccional
};

/**
 * Verifica si un código está protegido por la cajita guardiana
 * y retorna su versión segura garantizando unicidad
 */
const applyCodeGuardian = (code: string): string => {
  const normalized = code.trim().toUpperCase();

  // Si este código está en la lista guardiana, agregamos un sufijo único
  // para garantizar que NUNCA se agrupe con sus pares conflictivos
  if (CODE_GUARDIAN_MAP[normalized]) {
    // Creamos un fingerprint único basado en el código de cuenta original
    // para mantener trazabilidad pero garantizar separación
    const guardianSuffix = `::GUARDIAN::${normalized.replace(/[^0-9]/g, '').substring(0, 5)}`;

    return normalized + guardianSuffix;
  }

  return normalized;
};

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
          if (hasKeywordConflict(k, canonicalKey)) return false; // Guard against keyword collision (e.g. DÉBITO vs CRÉDITO)
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
      const rawCode = entry.accountCode.trim().toUpperCase();

      // ═══ GUARDIAN BOX: Garantizar que códigos conflictivos NUNCA se agrupen ═══
      targetKey = applyCodeGuardian(rawCode);

      // Check for keyword conflicts on the same code (e.g. IVA Débito vs IVA Crédito mapped to same code)
      let finalTargetKey = targetKey;

      // We must check if there is already an account with this code, but it has a conflicting name
      // Because there could be multiple splits, we need to find the right bucket
      let foundBucket = false;
      const possibleKeys = Object.keys(ledgerMap).filter(k => k === targetKey || k.startsWith(targetKey + '::SEPARATED::'));

      for (const pk of possibleKeys) {
        if (!hasKeywordConflict(ledgerMap[pk].accountName, entry.accountName)) {
          // Found a bucket without keyword conflict!
          finalTargetKey = pk;
          foundBucket = true;
          break;
        }
      }

      if (!foundBucket && possibleKeys.length > 0) {
        // All existing buckets have a keyword conflict. We must create a new separated bucket.
        finalTargetKey = targetKey + '::SEPARATED::' + normalizeText(entry.accountName).replace(/\s+/g, '_');
      }

      targetKey = finalTargetKey;

      // Check for inconsistent names for the same code
      if (ledgerMap[targetKey] && ledgerMap[targetKey].accountName !== entry.accountName) {
        // Registrar inconsistencia en Watchdog (no bloquear)
        newAlerts.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryId: entry.entryId,
          accountName: entry.accountName,
          description: `Discrepancia de Nombre en Código ${rawCode}`,
          severity: 'WARNING',
          message: `El código ${rawCode} tiene nombres inconsistentes: "${ledgerMap[targetKey].accountName}" vs "${entry.accountName}". Se agruparán bajo el primer nombre.`
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
