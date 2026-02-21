/**
 * ═══════════════════════════════════════════════════════════════════════
 *  WATCHDOG — Duplicate Detection Engine
 * ═══════════════════════════════════════════════════════════════════════
 *  Detects both exact and semantic duplicates across the account catalog.
 *
 *  Two detection modes:
 *    1. EXACT: Identical normalized codes or names → certainty = 1.0
 *    2. SEMANTIC: Near-matches via Levenshtein + Jaccard + dictionary
 *       → produces a similarity score [0..1]
 *
 *  Integrates with the existing `stringSimilarity.ts` critical keyword
 *  system to allow legitimate coexistence of accounts that share names
 *  but differ in semantic classification (e.g., "Dep. Equipo" vs
 *  "Dep. Acum. Equipo").
 *
 *  DETERMINISTIC: Same inputs → same outputs. No ML, no randomness.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
    NormalizedAccount,
    WatchdogMonitorAlert,
    AlertCategory,
    CorrectiveAction,
    classifyRisk,
    WatchdogConfig,
    DEFAULT_WATCHDOG_CONFIG,
} from './types';
import { levenshteinDistance, areStringsSimilar } from '../../utils/stringSimilarity';
import { normalizeText, tokenize } from './normalizationEngine';

// ─── Similarity Metrics ───────────────────────────────────────────────

/**
 * Calculates Jaccard similarity between two token sets.
 * J(A,B) = |A ∩ B| / |A ∪ B|
 *
 * @returns Similarity score [0..1]
 */
export const jaccardSimilarity = (tokensA: string[], tokensB: string[]): number => {
    if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
    if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection++;
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
};

/**
 * Calculates normalized Levenshtein similarity.
 * @returns Similarity score [0..1]
 */
export const levenshteinSimilarity = (a: string, b: string): number => {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const distance = levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    return (maxLen - distance) / maxLen;
};

/**
 * Combined similarity score using weighted Levenshtein + Jaccard.
 *
 * LevenshteinWeight = 0.6 (character-level precision)
 * JaccardWeight     = 0.4 (semantic/token-level coverage)
 */
export const combinedSimilarity = (
    normalizedA: string,
    normalizedB: string,
    tokensA: string[],
    tokensB: string[]
): number => {
    const levSim = levenshteinSimilarity(normalizedA, normalizedB);
    const jacSim = jaccardSimilarity(tokensA, tokensB);

    return (0.6 * levSim) + (0.4 * jacSim);
};

// ─── Duplicate Detection Results ──────────────────────────────────────

export interface DuplicatePair {
    accountA: NormalizedAccount;
    accountB: NormalizedAccount;
    /** Type of duplicate */
    type: 'EXACT' | 'SEMANTIC';
    /** Similarity score [0..1] */
    similarity: number;
    /** Levenshtein component */
    levenshteinScore: number;
    /** Jaccard component */
    jaccardScore: number;
    /** Whether the existing dictionary allows coexistence */
    dictionaryAllowsCoexistence: boolean;
}

// ─── Duplicate Detector ───────────────────────────────────────────────

/**
 * Detects exact duplicates: accounts with identical normalized codes or names.
 */
export const detectExactDuplicates = (
    accounts: NormalizedAccount[]
): DuplicatePair[] => {
    const pairs: DuplicatePair[] = [];
    const seenCodes = new Map<string, NormalizedAccount>();
    const seenNames = new Map<string, NormalizedAccount>();

    for (const account of accounts) {
        // Check by normalized code
        const existingByCode = seenCodes.get(account.normalizedCode);
        if (existingByCode && existingByCode.originalCode !== account.originalCode) {
            pairs.push({
                accountA: existingByCode,
                accountB: account,
                type: 'EXACT',
                similarity: 1.0,
                levenshteinScore: 1.0,
                jaccardScore: 1.0,
                dictionaryAllowsCoexistence: false,
            });
        } else {
            seenCodes.set(account.normalizedCode, account);
        }

        // Check by normalized name
        const existingByName = seenNames.get(account.normalizedName);
        if (existingByName && existingByName.originalCode !== account.originalCode) {
            // Only add if not already reported as code duplicate
            const alreadyReported = pairs.some(
                p =>
                    (p.accountA.originalCode === existingByName.originalCode &&
                        p.accountB.originalCode === account.originalCode) ||
                    (p.accountA.originalCode === account.originalCode &&
                        p.accountB.originalCode === existingByName.originalCode)
            );

            if (!alreadyReported) {
                pairs.push({
                    accountA: existingByName,
                    accountB: account,
                    type: 'EXACT',
                    similarity: 1.0,
                    levenshteinScore: 1.0,
                    jaccardScore: 1.0,
                    dictionaryAllowsCoexistence: false,
                });
            }
        } else {
            seenNames.set(account.normalizedName, account);
        }
    }

    return pairs;
};

/**
 * Detects semantic duplicates: accounts with similar (but not identical)
 * normalized names that may represent the same concept.
 *
 * Respects the existing critical keyword dictionary — if two accounts
 * differ in critical keywords (e.g., "ANTICIPADA" vs "CORRIENTE"),
 * they are NOT flagged as duplicates even if their names are similar.
 */
export const detectSemanticDuplicates = (
    accounts: NormalizedAccount[],
    config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): DuplicatePair[] => {
    const pairs: DuplicatePair[] = [];

    // O(n²) comparison — acceptable for account catalogs (typically < 500 accounts)
    for (let i = 0; i < accounts.length; i++) {
        for (let j = i + 1; j < accounts.length; j++) {
            const a = accounts[i];
            const b = accounts[j];

            // Skip if identical (already caught by exact detection)
            if (a.normalizedName === b.normalizedName) continue;
            if (a.normalizedCode === b.normalizedCode) continue;

            // Phase 1: Quick rejection — if names differ too much in length, skip
            const lenRatio = Math.min(a.normalizedName.length, b.normalizedName.length) /
                Math.max(a.normalizedName.length, b.normalizedName.length);
            if (lenRatio < 0.5) continue;

            // Phase 2: Check combined similarity
            const levScore = levenshteinSimilarity(a.normalizedName, b.normalizedName);
            const jacScore = jaccardSimilarity(a.tokens, b.tokens);
            const combined = (0.6 * levScore) + (0.4 * jacScore);

            if (combined < config.similarityThreshold) continue;

            // Phase 3: Consult the dictionary (existing stringSimilarity.ts)
            // areStringsSimilar already checks critical keywords and proper names
            const dictionaryAllows = !areStringsSimilar(
                a.originalName,
                b.originalName,
                config.similarityThreshold
            );

            pairs.push({
                accountA: a,
                accountB: b,
                type: 'SEMANTIC',
                similarity: combined,
                levenshteinScore: levScore,
                jaccardScore: jacScore,
                dictionaryAllowsCoexistence: dictionaryAllows,
            });
        }
    }

    return pairs;
};

// ─── Alert Generation ─────────────────────────────────────────────────

/**
 * Converts a DuplicatePair into a WatchdogMonitorAlert.
 */
export const createDuplicateAlert = (
    pair: DuplicatePair,
    cycleId: string
): WatchdogMonitorAlert => {
    const category: AlertCategory = pair.type === 'EXACT'
        ? 'EXACT_DUPLICATE'
        : 'SEMANTIC_DUPLICATE';

    const riskScore = pair.dictionaryAllowsCoexistence
        ? Math.max(0, pair.similarity - 0.20) // Reduce risk if dictionary says OK
        : pair.similarity;

    const riskLevel = classifyRisk(riskScore);

    const proposedAction: CorrectiveAction | undefined = pair.dictionaryAllowsCoexistence
        ? {
            type: 'FLAG_FOR_REVIEW',
            description: `Revisión manual: "${pair.accountA.originalName}" y "${pair.accountB.originalName}" ` +
                `son similares (${(pair.similarity * 100).toFixed(1)}%) pero el diccionario permite su coexistencia.`,
            targetAccounts: [pair.accountA.originalCode, pair.accountB.originalCode],
            confirmed: false,
        }
        : {
            type: 'MERGE_ACCOUNTS',
            description: `Fusionar "${pair.accountB.originalName}" con "${pair.accountA.originalName}" ` +
                `(similitud: ${(pair.similarity * 100).toFixed(1)}%).`,
            targetAccounts: [pair.accountA.originalCode, pair.accountB.originalCode],
            suggestedValue: pair.accountA.originalName,
            confirmed: false,
        };

    return {
        id: `WD-DUP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        category,
        riskLevel,
        riskScore,
        accountCode: pair.accountA.originalCode,
        accountName: pair.accountA.originalName,
        relatedAccountCode: pair.accountB.originalCode,
        relatedAccountName: pair.accountB.originalName,
        message: pair.type === 'EXACT'
            ? `[WATCHDOG] Duplicado exacto: "${pair.accountA.originalName}" ≡ "${pair.accountB.originalName}"`
            : `[WATCHDOG] Duplicado semántico: "${pair.accountA.originalName}" ≈ "${pair.accountB.originalName}" ` +
            `(similitud: ${(pair.similarity * 100).toFixed(1)}%)`,
        details: `Levenshtein: ${(pair.levenshteinScore * 100).toFixed(1)}% | ` +
            `Jaccard: ${(pair.jaccardScore * 100).toFixed(1)}% | ` +
            `Combinado: ${(pair.similarity * 100).toFixed(1)}% | ` +
            `Diccionario permite coexistencia: ${pair.dictionaryAllowsCoexistence ? 'SÍ' : 'NO'}`,
        proposedAction,
        acknowledged: false,
        cycleId,
    };
};
