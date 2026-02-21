/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Glosa Detection & Enforcement Engine
 * ═══════════════════════════════════════════════════════════════════════
 *  Sentinel module that guarantees glosas (narrative journal descriptions)
 *  are NEVER treated as accounting accounts. Intercepts at every layer of
 *  the data pipeline: parser output → ledger generation → UI operations.
 *
 *  A glosa is any text that starts with:
 *    • "Por …"             (narrative description of the transaction)
 *    • "DTE factura …"     (electronic tax document — invoice)
 *    • "DTE nota de envío" (electronic tax document — shipping note)
 *    • "Cheque no. …"      (check reference)
 *
 *  These are descriptions, NOT account names. They must never appear
 *  in the ledger, trial balance, or any accounting section.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { JournalEntry, WatchdogAlert } from '../../types';

// ─── Pattern Definitions ──────────────────────────────────────────────
// Each regex uses case-insensitive matching and trims whitespace.
// "Por" requires a following space to avoid false matches like "Porcentaje".

export const GLOSA_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'POR', regex: /^por\s+/i },
  { label: 'DTE_FACTURA', regex: /^dte\s+factura/i },
  { label: 'DTE_NOTA_ENVIO', regex: /^dte\s+nota\s+de\s+env[ií]o/i },
  { label: 'CHEQUE_NO', regex: /^cheque\s+no\.?\s*/i },
];

// ─── Core Detection ───────────────────────────────────────────────────

/**
 * Determines if a given text is a glosa (narrative description).
 * @param text — The account name or description to evaluate.
 * @returns `true` if the text matches any glosa pattern.
 */
export const isGlosa = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  return GLOSA_PATTERNS.some(pattern => pattern.regex.test(trimmed));
};

/**
 * Returns the label of the matched glosa pattern, or null if not a glosa.
 */
export const getGlosaPatternLabel = (text: string): string | null => {
  if (!text) return null;
  const trimmed = text.trim();
  const match = GLOSA_PATTERNS.find(p => p.regex.test(trimmed));
  return match ? match.label : null;
};

// ─── Alert Factory ────────────────────────────────────────────────────

/**
 * Builds a structured WatchdogAlert for a detected glosa entry.
 */
export const createWatchdogAlert = (
  entry: JournalEntry,
  severity: 'WARNING' | 'CRITICAL' = 'WARNING',
  customMessage?: string
): WatchdogAlert => {
  const patternLabel = getGlosaPatternLabel(entry.accountName) || 'GLOSA_PATTERN';
  return {
    id: `WD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    entryId: entry.entryId,
    accountName: entry.accountName,
    description: entry.description,
    severity,
    message: customMessage ||
      `[WATCHDOG] Glosa detectada como cuenta: "${entry.accountName}" (patrón: ${patternLabel}). ` +
      `Línea original: ${entry.originalLine}. Entrada en cuarentena — no se registrará como cuenta.`
  };
};

/**
 * Creates an alert for a blocked operation (e.g., attempted split into a glosa name).
 */
export const createBlockedOperationAlert = (
  accountName: string,
  operation: string
): WatchdogAlert => {
  const patternLabel = getGlosaPatternLabel(accountName) || 'GLOSA_PATTERN';
  return {
    id: `WD-BLOCK-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    entryId: 'N/A',
    accountName,
    description: `Operación bloqueada: ${operation}`,
    severity: 'CRITICAL',
    message:
      `[WATCHDOG] Operación "${operation}" BLOQUEADA: "${accountName}" es una glosa ` +
      `(patrón: ${patternLabel}). Las glosas no pueden registrarse como cuentas contables.`
  };
};

// ─── Batch Filtering ──────────────────────────────────────────────────

export interface FilterResult {
  /** Clean entries — safe to use in accounting records */
  clean: JournalEntry[];
  /** Quarantined entries — identified as glosas */
  quarantined: JournalEntry[];
  /** Alerts generated for each quarantined entry */
  alerts: WatchdogAlert[];
}

/**
 * Filters an array of JournalEntry objects, separating real accounts
 * from entries whose accountName matches a glosa pattern.
 *
 * This is the primary enforcement point — called right after parsing.
 */
export const filterGlosaEntries = (entries: JournalEntry[]): FilterResult => {
  const clean: JournalEntry[] = [];
  const quarantined: JournalEntry[] = [];
  const alerts: WatchdogAlert[] = [];

  for (const entry of entries) {
    if (isGlosa(entry.accountName)) {
      quarantined.push(entry);
      const alert = createWatchdogAlert(entry);
      alerts.push(alert);

      // Internal console warning (always fires — no silent failures)
      console.warn(alert.message);
    } else {
      clean.push(entry);
    }
  }

  if (quarantined.length > 0) {
    console.warn(
      `[WATCHDOG] ══════════════════════════════════════════════════\n` +
      `[WATCHDOG] ${quarantined.length} entrada(s) en cuarentena (glosas detectadas como cuentas).\n` +
      `[WATCHDOG] Estas entradas NO se incluirán en el Libro Mayor, Balance, ni exportaciones.\n` +
      `[WATCHDOG] ══════════════════════════════════════════════════`
    );
  }

  return { clean, quarantined, alerts };
};

// ─── Defense-in-Depth Guard ───────────────────────────────────────────

/**
 * Single-entry guard for use inside ledgerService or other downstream
 * consumers. Returns `true` if the entry is safe (not a glosa).
 * Logs a CRITICAL warning if a glosa is detected at this layer,
 * since it should have been caught upstream.
 */
export const guardEntry = (entry: JournalEntry): boolean => {
  if (isGlosa(entry.accountName)) {
    console.error(
      `[WATCHDOG:CRITICAL] ⚠️ Glosa escapó el filtro primario y llegó al Libro Mayor: ` +
      `"${entry.accountName}" (línea ${entry.originalLine}). Bloqueada en capa secundaria.`
    );
    return false; // NOT safe
  }
  return true; // Safe
};
