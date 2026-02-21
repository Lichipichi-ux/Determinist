/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Reputation Scoring Engine
 * ═══════════════════════════════════════════════════════════════════════
 *  Evaluates each account's "reputational" risk based on deterministic
 *  rules. The system assigns risk factors for:
 *
 *    1. Ambiguous naming — accounts with vague/generic names
 *    2. Persistent zero balance — accounts that never moved
 *    3. Balance-to-volume discrepancy — saldos mínimos con alto volumen
 *    4. Dictionary violations — names that conflict with known terms
 *    5. Invisible character presence — intentional obfuscation
 *    6. Unusual naming patterns — excessive special chars, numbers
 *
 *  Each factor produces a score [0..1], weighted and combined into
 *  a final reputation score: 0 = highly suspicious, 1 = fully clean.
 *
 *  DETERMINISTIC: Same inputs → same outputs. Rule-based only.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
    NormalizedAccount,
    ReputationProfile,
    ReputationFactor,
    WatchdogMonitorAlert,
    CorrectiveAction,
    classifyRisk,
    WatchdogConfig,
    DEFAULT_WATCHDOG_CONFIG,
} from './types';
import { detectInvisibleCharacters } from './normalizationEngine';

// ─── Ambiguity Dictionary ─────────────────────────────────────────────
// Account names containing these terms (alone or as primary identifier)
// are flagged as potentially ambiguous.

const AMBIGUOUS_TERMS = [
    'varios', 'otros', 'otros gastos', 'otra cuenta', 'misceláneos',
    'miscellaneous', 'general', 'cuenta general', 'temporal',
    'pendiente', 'por clasificar', 'sin clasificar', 'por definir',
    'transitoria', 'transitorio', 'puente', 'suspense',
    'ajuste', 'ajustes varios', 'provisional', 'temporal',
    'cuenta x', 'cuenta nueva', 'test', 'prueba',
];

/**
 * Normalized ambiguous terms for comparison.
 */
const NORMALIZED_AMBIGUOUS = AMBIGUOUS_TERMS.map(t => t.toLowerCase().trim());

// ─── Factor Evaluation Functions ──────────────────────────────────────

/**
 * Factor 1: Ambiguous naming.
 * Detects accounts with vague, generic, or deliberately ambiguous names.
 *
 * @returns Score [0..1] — higher = more suspicious
 */
const evaluateAmbiguity = (account: NormalizedAccount): ReputationFactor => {
    let score = 0;
    const reasons: string[] = [];

    // Check against ambiguous terms
    for (const term of NORMALIZED_AMBIGUOUS) {
        if (account.normalizedName.includes(term)) {
            score = Math.max(score, 0.7);
            reasons.push(`Nombre contiene término ambiguo: "${term}"`);
        }
        if (account.normalizedName === term) {
            score = 1.0;
            reasons.push(`Nombre es exactamente un término ambiguo: "${term}"`);
        }
    }

    // Very short name (< 3 chars) after normalization
    if (account.normalizedName.length > 0 && account.normalizedName.length < 3) {
        score = Math.max(score, 0.5);
        reasons.push(`Nombre demasiado corto: "${account.originalName}" (${account.normalizedName.length} chars)`);
    }

    // Name is purely numeric
    if (/^\d+$/.test(account.normalizedName)) {
        score = Math.max(score, 0.8);
        reasons.push(`Nombre es puramente numérico: "${account.originalName}"`);
    }

    return {
        name: 'AMBIGUITY',
        description: reasons.length > 0 ? reasons.join('; ') : 'Sin hallazgos de ambigüedad',
        score,
        weight: 0.20,
    };
};

/**
 * Factor 2: Persistent zero balance.
 * Accounts with zero balance AND no transaction volume are suspicious.
 */
const evaluateZeroBalance = (
    account: NormalizedAccount,
    config: WatchdogConfig
): ReputationFactor => {
    let score = 0;
    const reasons: string[] = [];

    const isZeroBalance = Math.abs(account.finalBalance) < 0.01;

    if (isZeroBalance && account.transactionCount === 0) {
        score = 0.9;
        reasons.push('Saldo cero sin movimientos históricos');
    } else if (isZeroBalance && account.transactionCount < config.minTransactionsForAnomaly) {
        score = 0.5;
        reasons.push(`Saldo cero con mínimos movimientos (${account.transactionCount})`);
    } else if (isZeroBalance && account.totalDebit === 0 && account.totalCredit === 0) {
        score = 1.0;
        reasons.push('Cuenta fantasma: cero débito, cero crédito, cero saldo');
    }

    return {
        name: 'ZERO_BALANCE',
        description: reasons.length > 0 ? reasons.join('; ') : 'Cuenta con actividad normal',
        score,
        weight: 0.20,
    };
};

/**
 * Factor 3: Balance-to-volume discrepancy.
 * Accounts with very small balances relative to their transaction volume
 * may indicate intentional dilution or laundering patterns.
 */
const evaluateBalanceVolumeRatio = (
    account: NormalizedAccount,
    config: WatchdogConfig
): ReputationFactor => {
    let score = 0;
    const reasons: string[] = [];

    const totalVolume = account.totalDebit + account.totalCredit;

    if (totalVolume > 0 && account.transactionCount >= config.minTransactionsForAnomaly) {
        const balanceRatio = Math.abs(account.finalBalance) / totalVolume;

        if (balanceRatio < config.balanceRatioThreshold && account.transactionCount > 5) {
            score = 0.7;
            reasons.push(
                `Saldo (${account.finalBalance.toFixed(2)}) es desproporcionadamente bajo ` +
                `respecto al volumen (${totalVolume.toFixed(2)}). Ratio: ${(balanceRatio * 100).toFixed(4)}%`
            );
        }
    }

    // Many transactions, zero balance
    if (account.transactionCount >= 10 && Math.abs(account.finalBalance) < 0.01) {
        score = Math.max(score, 0.6);
        reasons.push(
            `${account.transactionCount} transacciones pero saldo exactamente cero — posible ciclo de compensación`
        );
    }

    return {
        name: 'BALANCE_VOLUME_RATIO',
        description: reasons.length > 0 ? reasons.join('; ') : 'Relación saldo/volumen dentro de parámetros',
        score,
        weight: 0.25,
    };
};

/**
 * Factor 4: Invisible character presence.
 * Detects accounts with intentionally inserted invisible characters
 * (zero-width spaces, BOM, etc.) that could be used to create
 * visually identical but technically different accounts.
 */
const evaluateInvisibleCharacters = (account: NormalizedAccount): ReputationFactor => {
    let score = 0;
    const reasons: string[] = [];

    const findings = detectInvisibleCharacters(account.originalName);
    if (findings.length > 0) {
        score = 0.9;
        reasons.push(
            `${findings.length} carácter(es) invisible(s) detectado(s): ` +
            findings.map(f => `${f.description} en posición ${f.position}`).join(', ')
        );
    }

    const codeFindings = detectInvisibleCharacters(account.originalCode);
    if (codeFindings.length > 0) {
        score = 1.0;
        reasons.push(
            `${codeFindings.length} carácter(es) invisible(s) en código: ` +
            codeFindings.map(f => `${f.description} en posición ${f.position}`).join(', ')
        );
    }

    return {
        name: 'INVISIBLE_CHARS',
        description: reasons.length > 0 ? reasons.join('; ') : 'Sin caracteres invisibles',
        score,
        weight: 0.20,
    };
};

/**
 * Factor 5: Unusual naming patterns.
 * Flags accounts with excessive special characters, all-caps with random
 * casing variations, or other naming anomalies.
 */
const evaluateNamingPatterns = (account: NormalizedAccount): ReputationFactor => {
    let score = 0;
    const reasons: string[] = [];

    const name = account.originalName;

    // Excessive special characters (> 30% of name)
    const specialCharCount = (name.match(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s]/g) || []).length;
    if (name.length > 0 && specialCharCount / name.length > 0.3) {
        score = Math.max(score, 0.6);
        reasons.push(`Excesivos caracteres especiales: ${specialCharCount} de ${name.length}`);
    }

    // Double spaces (after trim)
    if (/\s{2,}/.test(name.trim())) {
        score = Math.max(score, 0.3);
        reasons.push('Contiene espacios dobles (posible manipulación)');
    }

    // Leading/trailing whitespace preserved in original
    if (name !== name.trim()) {
        score = Math.max(score, 0.4);
        reasons.push('Espacios en blanco al inicio o final del nombre');
    }

    return {
        name: 'NAMING_PATTERNS',
        description: reasons.length > 0 ? reasons.join('; ') : 'Patrón de nombre normal',
        score,
        weight: 0.15,
    };
};

// ─── Main Reputation Evaluator ────────────────────────────────────────

/**
 * Evaluates the reputation of a single account.
 * Produces a `ReputationProfile` with all factor scores and a final
 * weighted reputation score.
 */
export const evaluateReputation = (
    account: NormalizedAccount,
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): ReputationProfile => {
    const factors: ReputationFactor[] = [
        evaluateAmbiguity(account),
        evaluateZeroBalance(account, config),
        evaluateBalanceVolumeRatio(account, config),
        evaluateInvisibleCharacters(account),
        evaluateNamingPatterns(account),
    ];

    // Calculate weighted risk score
    let totalWeight = 0;
    let weightedRisk = 0;

    for (const factor of factors) {
        weightedRisk += factor.score * factor.weight;
        totalWeight += factor.weight;
    }

    // Normalize to [0..1]
    const riskScore = totalWeight > 0 ? weightedRisk / totalWeight : 0;

    // Reputation = 1 - risk (higher reputation = lower risk)
    const reputationScore = 1 - riskScore;

    return {
        accountCode: account.originalCode,
        accountName: account.originalName,
        reputationScore,
        factors,
        riskLevel: classifyRisk(riskScore),
        lastEvaluated: new Date().toISOString(),
    };
};

/**
 * Batch-evaluates reputation for all accounts.
 */
export const evaluateAllReputations = (
    accounts: NormalizedAccount[],
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): ReputationProfile[] => {
    return accounts.map(a => evaluateReputation(a, config));
};

// ─── Alert Generation ─────────────────────────────────────────────────

/**
 * Creates alerts for accounts with risk scores above OBSERVATION threshold.
 */
export const createReputationAlerts = (
    profiles: ReputationProfile[],
    cycleId: string
): WatchdogMonitorAlert[] => {
    const alerts: WatchdogMonitorAlert[] = [];

    for (const profile of profiles) {
        if (profile.riskLevel === 'NORMAL') continue;

        const riskScore = 1 - profile.reputationScore;
        const failingFactors = profile.factors
            .filter(f => f.score > 0.3)
            .map(f => `${f.name}: ${(f.score * 100).toFixed(0)}%`)
            .join(', ');

        const proposedAction: CorrectiveAction = riskScore >= 0.85
            ? {
                type: 'QUARANTINE_ACCOUNT',
                description: `Cuarentena automática: "${profile.accountName}" tiene un riesgo reputacional de ${(riskScore * 100).toFixed(1)}%.`,
                targetAccounts: [profile.accountCode],
                confirmed: false,
            }
            : {
                type: 'FLAG_FOR_REVIEW',
                description: `Revisión requerida: "${profile.accountName}" tiene factores de riesgo detectados.`,
                targetAccounts: [profile.accountCode],
                confirmed: false,
            };

        alerts.push({
            id: `WD-REP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            category: 'REPUTATION_RISK',
            riskLevel: profile.riskLevel,
            riskScore,
            accountCode: profile.accountCode,
            accountName: profile.accountName,
            message: `[WATCHDOG] Cuenta de dudosa reputación: "${profile.accountName}" — ` +
                `Riesgo: ${profile.riskLevel} (${(riskScore * 100).toFixed(1)}%)`,
            details: `Factores de riesgo: ${failingFactors || 'Ninguno significativo'}. ` +
                `Reputación general: ${(profile.reputationScore * 100).toFixed(1)}%.`,
            proposedAction,
            acknowledged: false,
            cycleId,
        });
    }

    return alerts;
};
