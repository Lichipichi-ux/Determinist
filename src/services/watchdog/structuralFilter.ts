/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Structural Account Filter
 * ═══════════════════════════════════════════════════════════════════════
 *  Prevents structural/parent accounts (subtítulos sin movimiento) from
 *  being transferred to the Mayor (Sección de Cuentas).
 *
 *  REGLA CENTRAL:
 *    Si una cuenta tiene código y nombre válidos pero Debe = 0 y
 *    Haber = 0 en TODAS sus apariciones → NO trasladar al Mayor.
 *
 *  CONDICIÓN CORRECTA:
 *    Movimiento válido = al menos una entrada con debit > 0 OR credit > 0.
 *    El saldo final NO es el criterio — una cuenta compensada (saldo = 0
 *    pero con movimiento real) debe incluirse.
 *
 *  DETERMINISTIC: Same inputs → same outputs. Zero randomness.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { AccountLedger } from '../../types';

// ─── Core Detection ───────────────────────────────────────────────────

/**
 * Returns true if the account has at least one entry with a real monetary
 * movement (debit > 0 OR credit > 0).
 *
 * Note: We use individual entry amounts, NOT the final balance or totals,
 * so that compensated accounts (net saldo = 0 but with real activity)
 * are correctly preserved.
 */
const hasRealMovement = (account: AccountLedger): boolean =>
  account.entries.some(e => e.debit > 0 || e.credit > 0);

/**
 * Returns true if the account is a structural title with no real activity.
 * These are typically parent/grouping codes that appear in the journal
 * as row labels but carry no monetary value.
 */
const isStructuralAccount = (account: AccountLedger): boolean =>
  !hasRealMovement(account);

// ─── Hierarchical Parent Detection ───────────────────────────────────

/**
 * Determines whether a given account code is a parent of any code in the
 * provided key set. A code X is a parent of Y if Y starts with X + ".".
 *
 * Example: "1011.01" is a parent of "1011.01.01".
 *
 * This is a secondary guard: a parent code without movement is structural
 * by definition.
 */
const isParentCode = (code: string, allCodes: string[]): boolean =>
  allCodes.some(other => other !== code && other.startsWith(code + '.'));

// ─── Main Filter ──────────────────────────────────────────────────────

/**
 * Filters out structural accounts (subtítulos, cuentas padre sin valores)
 * from the ledger map before building the Mayor section.
 *
 * An account is excluded when ALL of the following hold:
 *   - It has no entries with debit > 0 or credit > 0
 *   - Its totalDebit and totalCredit are both 0
 *
 * Accounts that had real movement (even if their final balance is zero due
 * to compensation) are always preserved.
 *
 * @param ledgerMap - The full account map produced by generateLedger().
 * @returns A new map containing only operationally active accounts.
 */
export const filterStructuralAccounts = (
  ledgerMap: Record<string, AccountLedger>
): Record<string, AccountLedger> => {
  const allCodes = Object.values(ledgerMap).map(a => a.accountCode);
  const filtered: Record<string, AccountLedger> = {};
  const excluded: Array<{ code: string; name: string; reason: string }> = [];

  for (const [key, account] of Object.entries(ledgerMap)) {
    if (isStructuralAccount(account)) {
      const reason = isParentCode(account.accountCode, allCodes)
        ? 'Cuenta padre sin movimiento propio (subtítulo jerárquico)'
        : 'Sin movimiento (Debe = 0 y Haber = 0 en todas las entradas)';

      excluded.push({ code: account.accountCode, name: account.accountName, reason });
      continue;
    }

    filtered[key] = account;
  }

  if (excluded.length > 0) {
    console.info(
      `[WATCHDOG:STRUCTURAL_FILTER] ${excluded.length} cuenta(s) excluida(s) del Mayor por ausencia de movimiento:`
    );
    for (const e of excluded) {
      console.info(`  ✘ ${e.code} — "${e.name}" | ${e.reason}`);
    }
  }

  return filtered;
};
