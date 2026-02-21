/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Risk Scoring Composer
 * ═══════════════════════════════════════════════════════════════════════
 *  Combines all detection signals into a unified Risk Score per account.
 *
 *  Formula:
 *    RiskScore = (SimilarityWeight × DuplicateProbability)
 *              + (BalanceWeight  × AnomalyScore)
 *              + (DictionaryWeight × DictionaryConflict)
 *
 *  Thresholds:
 *    ≥ 0.85 → CRITICAL  (Bloqueo preventivo)
 *    0.60–0.84 → HIGH   (Alerta roja)
 *    0.40–0.59 → OBSERVATION (Observación)
 *    < 0.40 → NORMAL
 *
 *  DETERMINISTIC: Same inputs → same composite score.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
    NormalizedAccount,
    RiskScoreBreakdown,
    RiskWeights,
    DEFAULT_RISK_WEIGHTS,
    classifyRisk,
    RiskLevel,
    WatchdogConfig,
    DEFAULT_WATCHDOG_CONFIG,
    ReputationProfile,
} from './types';
import { DuplicatePair } from './duplicateEngine';
import { evaluateReputation } from './reputationEngine';
import { AnomalyFinding } from './anomalyEngine';

// ─── Composite Risk Profile ──────────────────────────────────────────

export interface CompositeRiskProfile {
    accountCode: string;
    accountName: string;
    /** Breakdown of each score component */
    breakdown: RiskScoreBreakdown;
    /** Final classified risk level */
    riskLevel: RiskLevel;
    /** All contributing signals */
    signals: RiskSignal[];
}

export interface RiskSignal {
    source: 'DUPLICATE' | 'ANOMALY' | 'REPUTATION' | 'DICTIONARY';
    description: string;
    rawScore: number;
}

// ─── Score Computation ────────────────────────────────────────────────

/**
 * Computes the composite risk score for a single account.
 *
 * Inputs:
 *   - duplicatePairs: any DuplicatePair involving this account
 *   - anomalyFindings: anomaly findings for this account
 *   - reputationProfile: reputation evaluation for this account
 *
 * The function aggregates the highest signal from each category
 * and computes a weighted final score.
 */
export const computeCompositeRisk = (
    account: NormalizedAccount,
    duplicatePairs: DuplicatePair[],
    anomalyFindings: AnomalyFinding[],
    reputationProfile: ReputationProfile | null,
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): CompositeRiskProfile => {
    const weights = config.weights;
    const signals: RiskSignal[] = [];

    // ─── Component 1: Duplicate Probability ───────────────────────
    // Take the highest similarity score from all pairs involving this account
    let duplicateProbability = 0;

    for (const pair of duplicatePairs) {
        const involves =
            pair.accountA.originalCode === account.originalCode ||
            pair.accountB.originalCode === account.originalCode;

        if (involves) {
            // If dictionary allows coexistence, reduce the signal
            const adjustedScore = pair.dictionaryAllowsCoexistence
                ? pair.similarity * 0.4
                : pair.similarity;

            duplicateProbability = Math.max(duplicateProbability, adjustedScore);

            signals.push({
                source: 'DUPLICATE',
                description: `${pair.type}: "${pair.accountA.originalName}" ↔ "${pair.accountB.originalName}" ` +
                    `(similitud: ${(pair.similarity * 100).toFixed(1)}%)`,
                rawScore: pair.similarity,
            });
        }
    }

    // ─── Component 2: Anomaly Score ───────────────────────────────
    // Aggregate anomaly findings — take the maximum
    let anomalyScore = 0;

    for (const finding of anomalyFindings) {
        if (finding.accountCode === account.originalCode) {
            anomalyScore = Math.max(anomalyScore, finding.score);

            signals.push({
                source: 'ANOMALY',
                description: `${finding.ruleName}: ${finding.description}`,
                rawScore: finding.score,
            });
        }
    }

    // ─── Component 3: Dictionary Conflict ─────────────────────────
    // Derived from reputation profile — specifically, naming and ambiguity
    let dictionaryConflict = 0;

    if (reputationProfile) {
        const riskFromReputation = 1 - reputationProfile.reputationScore;
        dictionaryConflict = riskFromReputation;

        for (const factor of reputationProfile.factors) {
            if (factor.score > 0.3) {
                signals.push({
                    source: 'REPUTATION',
                    description: `${factor.name}: ${factor.description}`,
                    rawScore: factor.score,
                });
            }
        }
    }

    // ─── Weighted Final Score ─────────────────────────────────────
    const finalScore = (weights.similarity * duplicateProbability)
        + (weights.balance * anomalyScore)
        + (weights.dictionary * dictionaryConflict);

    // Clamp to [0, 1]
    const clampedScore = Math.min(1, Math.max(0, finalScore));

    return {
        accountCode: account.originalCode,
        accountName: account.originalName,
        breakdown: {
            duplicateProbability,
            anomalyScore,
            dictionaryConflict,
            finalScore: clampedScore,
            weights,
        },
        riskLevel: classifyRisk(clampedScore),
        signals,
    };
};

/**
 * Batch-computes composite risk for all accounts.
 */
export const computeAllCompositeRisks = (
    accounts: NormalizedAccount[],
    duplicatePairs: DuplicatePair[],
    anomalyFindings: AnomalyFinding[],
    reputationProfiles: ReputationProfile[],
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): CompositeRiskProfile[] => {
    const reputationMap = new Map<string, ReputationProfile>();
    for (const profile of reputationProfiles) {
        reputationMap.set(profile.accountCode, profile);
    }

    return accounts.map(account =>
        computeCompositeRisk(
            account,
            duplicatePairs,
            anomalyFindings,
            reputationMap.get(account.originalCode) || null,
            config
        )
    );
};

/**
 * Filters profiles by risk level — returns only those at or above the given threshold.
 */
export const filterByRiskLevel = (
    profiles: CompositeRiskProfile[],
    minLevel: RiskLevel
): CompositeRiskProfile[] => {
    const levelOrder: Record<RiskLevel, number> = {
        NORMAL: 0,
        OBSERVATION: 1,
        HIGH: 2,
        CRITICAL: 3,
    };

    const minOrder = levelOrder[minLevel];
    return profiles.filter(p => levelOrder[p.riskLevel] >= minOrder);
};
