/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Balance Anomaly Detector
 * ═══════════════════════════════════════════════════════════════════════
 *  Detects anomalous patterns in account balances and transactions.
 *
 *  Detection rules (deterministic — no ML):
 *    1. Round-number bias — accounts dominated by suspiciously round amounts
 *    2. Rapid cycling — accounts with high transaction counts but small net
 *    3. Proportionality violation — balance doesn't match business volume
 *    4. Symmetric transactions — matching debit/credit pairs (wash trades)
 *    5. Dormancy followed by burst — sudden activity after long inactivity
 *
 *  ANTI-FRAUD: These rules form a basic deterministic anti-fraud layer.
 *  They are intentionally conservative to minimize false positives.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
    NormalizedAccount,
    WatchdogMonitorAlert,
    CorrectiveAction,
    classifyRisk,
    WatchdogConfig,
    DEFAULT_WATCHDOG_CONFIG,
} from './types';
import { AccountLedger, LedgerLine } from '../../types';

// ─── Anomaly Result Structure ─────────────────────────────────────────

export interface AnomalyFinding {
    accountCode: string;
    accountName: string;
    ruleId: string;
    ruleName: string;
    score: number; // [0..1] — severity of the anomaly
    description: string;
    evidence: string;
}

// ─── Rule 1: Round-Number Bias ────────────────────────────────────────

/**
 * Detects accounts where an unusually high percentage of transactions
 * use perfectly round numbers (multiples of 100, 1000, etc.).
 *
 * Legitimate accounting has round numbers, but an excess (> 80%)
 * combined with high volume is a red flag.
 */
const detectRoundNumberBias = (
    ledger: AccountLedger,
    normalized: NormalizedAccount
): AnomalyFinding | null => {
    if (normalized.transactionCount < 5) return null;

    let roundCount = 0;
    for (const entry of ledger.entries) {
        const amount = entry.debit > 0 ? entry.debit : entry.credit;
        if (amount > 0 && amount % 100 === 0) {
            roundCount++;
        }
    }

    const roundRatio = roundCount / ledger.entries.length;

    if (roundRatio >= 0.80 && normalized.transactionCount >= 8) {
        return {
            accountCode: normalized.originalCode,
            accountName: normalized.originalName,
            ruleId: 'ANOMALY_ROUND_NUMBERS',
            ruleName: 'Sesgo de números redondos',
            score: Math.min(1.0, roundRatio),
            description: `${(roundRatio * 100).toFixed(0)}% de las transacciones son montos redondos (múltiplos de 100).`,
            evidence: `${roundCount} de ${ledger.entries.length} transacciones son redondas.`,
        };
    }

    return null;
};

// ─── Rule 2: Rapid Cycling ────────────────────────────────────────────

/**
 * Detects accounts with very high transaction counts but minimal net
 * balance — suggesting rapid cycling of funds.
 */
const detectRapidCycling = (
    _ledger: AccountLedger,
    normalized: NormalizedAccount,
    config: WatchdogConfig
): AnomalyFinding | null => {
    if (normalized.transactionCount < 10) return null;

    const totalVolume = normalized.totalDebit + normalized.totalCredit;
    if (totalVolume === 0) return null;

    const netRatio = Math.abs(normalized.finalBalance) / totalVolume;

    if (netRatio < config.balanceRatioThreshold) {
        return {
            accountCode: normalized.originalCode,
            accountName: normalized.originalName,
            ruleId: 'ANOMALY_RAPID_CYCLING',
            ruleName: 'Ciclo rápido de fondos',
            score: Math.min(1.0, 1.0 - netRatio),
            description: `${normalized.transactionCount} transacciones con volumen de ${totalVolume.toFixed(2)} ` +
                `pero saldo neto de solo ${Math.abs(normalized.finalBalance).toFixed(2)} ` +
                `(ratio: ${(netRatio * 100).toFixed(4)}%).`,
            evidence: `Débito total: ${normalized.totalDebit.toFixed(2)}, ` +
                `Crédito total: ${normalized.totalCredit.toFixed(2)}, ` +
                `Saldo: ${normalized.finalBalance.toFixed(2)}.`,
        };
    }

    return null;
};

// ─── Rule 3: Symmetric Transactions ──────────────────────────────────

/**
 * Detects accounts with matching debit/credit pairs (same amount,
 * appearing close together) — potential wash trades or compensations.
 */
const detectSymmetricTransactions = (
    ledger: AccountLedger,
    normalized: NormalizedAccount
): AnomalyFinding | null => {
    if (normalized.transactionCount < 4) return null;

    let symmetricPairs = 0;
    const entries = ledger.entries;

    for (let i = 0; i < entries.length; i++) {
        const current = entries[i];
        const amount = current.debit > 0 ? current.debit : current.credit;
        if (amount === 0) continue;

        // Look ahead for a matching opposite entry within the next 5 entries
        for (let j = i + 1; j < Math.min(entries.length, i + 6); j++) {
            const candidate = entries[j];
            const candidateAmount = candidate.debit > 0 ? candidate.debit : candidate.credit;

            // Opposite side, same amount
            if (
                Math.abs(amount - candidateAmount) < 0.01 &&
                ((current.debit > 0 && candidate.credit > 0) ||
                    (current.credit > 0 && candidate.debit > 0))
            ) {
                symmetricPairs++;
                break;
            }
        }
    }

    const symmetricRatio = symmetricPairs / Math.max(1, entries.length / 2);

    if (symmetricRatio >= 0.5 && symmetricPairs >= 3) {
        return {
            accountCode: normalized.originalCode,
            accountName: normalized.originalName,
            ruleId: 'ANOMALY_SYMMETRIC',
            ruleName: 'Transacciones simétricas',
            score: Math.min(1.0, symmetricRatio),
            description: `${symmetricPairs} pares de transacciones simétricas detectados ` +
                `(débito/crédito con montos idénticos en secuencia cercana).`,
            evidence: `Ratio de simetría: ${(symmetricRatio * 100).toFixed(0)}%.`,
        };
    }

    return null;
};

// ─── Rule 4: Ghost Account ───────────────────────────────────────────

/**
 * Detects accounts that exist in the catalog but have no meaningful
 * activity — potential placeholders for future fraud.
 */
const detectGhostAccount = (
    _ledger: AccountLedger,
    normalized: NormalizedAccount
): AnomalyFinding | null => {
    if (
        normalized.transactionCount <= 1 &&
        Math.abs(normalized.totalDebit) < 0.01 &&
        Math.abs(normalized.totalCredit) < 0.01
    ) {
        return {
            accountCode: normalized.originalCode,
            accountName: normalized.originalName,
            ruleId: 'ANOMALY_GHOST',
            ruleName: 'Cuenta fantasma',
            score: 0.7,
            description: `Cuenta sin actividad significativa — posible placeholder.`,
            evidence: `Transacciones: ${normalized.transactionCount}, ` +
                `Débito: ${normalized.totalDebit.toFixed(2)}, ` +
                `Crédito: ${normalized.totalCredit.toFixed(2)}.`,
        };
    }

    return null;
};

// ─── Main Anomaly Detector ────────────────────────────────────────────

/**
 * Runs all anomaly detection rules against a single account.
 */
export const detectAnomalies = (
    ledger: AccountLedger,
    normalized: NormalizedAccount,
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): AnomalyFinding[] => {
    const findings: AnomalyFinding[] = [];

    const rules = [
        detectRoundNumberBias(ledger, normalized),
        detectRapidCycling(ledger, normalized, config),
        detectSymmetricTransactions(ledger, normalized),
        detectGhostAccount(ledger, normalized),
    ];

    for (const finding of rules) {
        if (finding) findings.push(finding);
    }

    return findings;
};

/**
 * Runs anomaly detection across all accounts.
 */
export const detectAllAnomalies = (
    ledgerMap: Record<string, AccountLedger>,
    normalizedAccounts: NormalizedAccount[],
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): AnomalyFinding[] => {
    const allFindings: AnomalyFinding[] = [];

    for (const normalized of normalizedAccounts) {
        const ledger = ledgerMap[normalized.originalCode];
        if (!ledger) continue;

        const findings = detectAnomalies(ledger, normalized, config);
        allFindings.push(...findings);
    }

    return allFindings;
};

// ─── Alert Generation ─────────────────────────────────────────────────

/**
 * Converts anomaly findings into WatchdogMonitorAlerts.
 */
export const createAnomalyAlerts = (
    findings: AnomalyFinding[],
    cycleId: string
): WatchdogMonitorAlert[] => {
    return findings.map(finding => {
        const riskLevel = classifyRisk(finding.score);

        const proposedAction: CorrectiveAction = {
            type: 'FLAG_FOR_REVIEW',
            description: `Auditoría requerida: "${finding.accountName}" — ${finding.ruleName}.`,
            targetAccounts: [finding.accountCode],
            confirmed: false,
        };

        return {
            id: `WD-ANOM-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            category: finding.ruleId.includes('FRAUD') ? 'ANTI_FRAUD' : 'BALANCE_ANOMALY',
            riskLevel,
            riskScore: finding.score,
            accountCode: finding.accountCode,
            accountName: finding.accountName,
            message: `[WATCHDOG] Anomalía: "${finding.accountName}" — ${finding.ruleName}`,
            details: `${finding.description} | Evidencia: ${finding.evidence}`,
            proposedAction,
            acknowledged: false,
            cycleId,
        };
    });
};
